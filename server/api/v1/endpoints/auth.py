from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_access_token,
)
from models.user import User
from models.group import Group
from schemas.auth import (
    UserSignup,
    UserLogin,
    UserResponse,
    Token,
    GroupResponse,
    SetUserGroupsRequest,
)

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def require_groups(*group_names: str):
    """Dependency: current user must belong to at least one of the given groups."""

    async def _require(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
        db.refresh(current_user, ["groups"])
        user_group_names = {g.name for g in current_user.groups}
        if not user_group_names.intersection(set(group_names)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _require


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(user_data: UserSignup, db: Session = Depends(get_db)):
    """Create a new user account."""
    # Check if passwords match
    if user_data.password != user_data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match",
        )

    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Validate password length
    if len(user_data.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long",
        )

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        first_name=user_data.first_name,
        hashed_password=hashed_password,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        first_name=new_user.first_name,
        is_active=new_user.is_active,
        groups=[],
    )


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    """Login and get access token."""
    # Find user by email
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    # Create access token
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login-json", response_model=Token)
async def login_json(user_data: UserLogin, db: Session = Depends(get_db)):
    """Login with JSON body (alternative to form data)."""
    # Find user by email
    user = db.query(User).filter(User.email == user_data.email).first()

    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    # Create access token
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})

    return {"access_token": access_token, "token_type": "bearer"}


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    """Get the current authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception

    return user


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current user information including group names."""
    db.refresh(current_user, ["groups"])
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        is_active=current_user.is_active,
        groups=[g.name for g in current_user.groups],
    )


# --- Groups (admin) ---

require_admin = require_groups("admin")


@router.get("/groups", response_model=list[GroupResponse])
async def list_groups(db: Session = Depends(get_db)):
    """List all groups. No auth required for listing (group names are not sensitive)."""
    groups = db.query(Group).order_by(Group.name).all()
    return groups


@router.put("/admin/users/{user_id}/groups", response_model=UserResponse)
async def set_user_groups(
    user_id: int,
    body: SetUserGroupsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Set which groups a user belongs to. Requires admin group."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    groups = (
        db.query(Group)
        .filter(Group.name.in_(body.group_names))
        .all()
    )
    found_names = {g.name for g in groups}
    invalid = set(body.group_names) - found_names
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown group(s): {sorted(invalid)}",
        )

    user.groups = groups
    db.commit()
    db.refresh(user)
    db.refresh(user, ["groups"])

    return UserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        is_active=user.is_active,
        groups=[g.name for g in user.groups],
    )

