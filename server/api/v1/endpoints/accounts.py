from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session, joinedload
from typing import List
from core.database import get_db
from api.v1.endpoints.auth import get_current_user
from models.user import User
from models.finance import Ledger, LedgerGroup, ParentLedgerGroup, LedgerItem, TransactionItem
from schemas.finance import (
    LedgerCreate,
    LedgerResponse,
    LedgerWithGroup,
    LedgerGroupCreate,
    LedgerGroupResponse,
    LedgerGroupWithParent,
    ParentLedgerGroupCreate,
    ParentLedgerGroupResponse,
    LedgerItemCreate,
    LedgerItemResponse,
    LedgerItemWithLedger,
)

router = APIRouter()


@router.get("/parent-groups", response_model=List[ParentLedgerGroupResponse])
async def get_parent_ledger_groups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all parent ledger groups (universal), ordered by sort_order."""
    from sqlalchemy import nullslast
    groups = (
        db.query(ParentLedgerGroup)
        .filter(ParentLedgerGroup.is_active == True)
        .order_by(nullslast(ParentLedgerGroup.sort_order), ParentLedgerGroup.name)
        .all()
    )
    return groups


@router.post(
    "/parent-groups",
    response_model=ParentLedgerGroupResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_parent_ledger_group(
    group_data: ParentLedgerGroupCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new parent ledger group (universal)."""
    # Check for duplicate name
    existing = db.query(ParentLedgerGroup).filter(ParentLedgerGroup.name == group_data.name).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parent ledger group with this name already exists",
        )

    new_group = ParentLedgerGroup(
        name=group_data.name,
        sort_order=group_data.sort_order,
    )

    db.add(new_group)
    db.commit()
    db.refresh(new_group)

    return new_group


@router.get("/groups", response_model=List[LedgerGroupWithParent])
async def get_ledger_groups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    parent_group_id: int = None,
):
    """Get all ledger groups (universal)."""
    query = db.query(LedgerGroup).filter(LedgerGroup.is_active == True)

    if parent_group_id:
        query = query.filter(LedgerGroup.parent_ledger_group_id == parent_group_id)

    groups = query.order_by(
        LedgerGroup.parent_ledger_group_id,
        LedgerGroup.name,
    ).all()
    return groups


@router.post(
    "/groups",
    response_model=LedgerGroupResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_ledger_group(
    group_data: LedgerGroupCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new ledger group (universal)."""
    # Verify parent ledger group exists
    parent_group = (
        db.query(ParentLedgerGroup)
        .filter(
            ParentLedgerGroup.id == group_data.parent_ledger_group_id,
            ParentLedgerGroup.is_active == True,
        )
        .first()
    )

    if not parent_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent ledger group not found",
        )

    # Check for duplicate name
    existing = db.query(LedgerGroup).filter(LedgerGroup.name == group_data.name).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ledger group with this name already exists",
        )

    new_group = LedgerGroup(
        name=group_data.name,
        parent_ledger_group_id=group_data.parent_ledger_group_id,
        category=group_data.category,
    )

    db.add(new_group)
    db.commit()
    db.refresh(new_group)

    return new_group


def _get_active_ledger_for_user(db: Session, ledger_id: int, user_id: int) -> Ledger:
    ledger = (
        db.query(Ledger)
        .filter(Ledger.id == ledger_id, Ledger.user_id == user_id, Ledger.is_active == True)
        .first()
    )
    if not ledger:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ledger not found")
    return ledger


@router.get("/ledger-items", response_model=List[LedgerItemWithLedger])
async def get_ledger_items(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all ledger items (what the user buys/earns, e.g. "Tea Leaves") for the current user."""
    items = (
        db.query(LedgerItem)
        .options(joinedload(LedgerItem.ledger))
        .filter(LedgerItem.user_id == current_user.id)
        .filter(LedgerItem.is_active == True)
        .order_by(LedgerItem.name)
        .all()
    )
    return items


@router.post(
    "/ledger-items",
    response_model=LedgerItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_ledger_item(
    item_data: LedgerItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new ledger item. Transaction lines post to item.ledger_id."""
    _get_active_ledger_for_user(db, item_data.ledger_id, current_user.id)

    existing = (
        db.query(LedgerItem)
        .filter(
            LedgerItem.name == item_data.name,
            LedgerItem.user_id == current_user.id,
            LedgerItem.is_active == True,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Item with this name already exists",
        )

    new_item = LedgerItem(
        user_id=current_user.id,
        name=item_data.name,
        ledger_id=item_data.ledger_id,
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    return new_item


@router.put("/ledger-items/{item_id}", response_model=LedgerItemResponse)
async def update_ledger_item(
    item_id: int,
    item_data: LedgerItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a ledger item. Reassigning ledger_id re-posts every past
    transaction line tagged with this item to the new ledger, so historical
    reports reflect the new classification immediately."""
    item = (
        db.query(LedgerItem)
        .filter(LedgerItem.id == item_id, LedgerItem.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    _get_active_ledger_for_user(db, item_data.ledger_id, current_user.id)

    existing = (
        db.query(LedgerItem)
        .filter(
            LedgerItem.name == item_data.name,
            LedgerItem.user_id == current_user.id,
            LedgerItem.id != item_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Item with this name already exists",
        )

    item.name = item_data.name
    if item_data.ledger_id != item.ledger_id:
        db.query(TransactionItem).filter(TransactionItem.item_id == item.id).update(
            {TransactionItem.ledger_id: item_data.ledger_id}
        )
        item.ledger_id = item_data.ledger_id

    db.commit()
    db.refresh(item)

    return item


@router.delete("/ledger-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ledger_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft delete a ledger item by setting is_active to False."""
    item = (
        db.query(LedgerItem)
        .filter(LedgerItem.id == item_id, LedgerItem.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    item.is_active = False
    db.commit()

    return None


@router.post("/", response_model=LedgerResponse, status_code=status.HTTP_201_CREATED)
async def create_ledger(
    ledger_data: LedgerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new ledger (account)."""
    # Verify ledger group exists
    ledger_group = (
        db.query(LedgerGroup)
        .filter(
            LedgerGroup.id == ledger_data.ledger_group_id,
            LedgerGroup.is_active == True,
        )
        .first()
    )

    if not ledger_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ledger group not found",
        )

    # Check for duplicate name for this user
    existing_ledger = (
        db.query(Ledger)
        .filter(
            Ledger.name == ledger_data.name,
            Ledger.user_id == current_user.id,
            Ledger.is_active == True,
        )
        .first()
    )

    if existing_ledger:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ledger with this name already exists",
        )

    # Create new ledger
    new_ledger = Ledger(
        user_id=current_user.id,
        name=ledger_data.name,
        ledger_group_id=ledger_data.ledger_group_id,
    )

    db.add(new_ledger)
    db.commit()
    db.refresh(new_ledger)

    return new_ledger


@router.get("/", response_model=List[LedgerWithGroup])
async def get_ledgers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    group_id: int = None,
    include_inactive: bool = False,
):
    """Get all ledgers (accounts) for the current user."""
    query = (
        db.query(Ledger)
        .options(
            joinedload(Ledger.ledger_group).joinedload(LedgerGroup.parent_ledger_group),
        )
        .filter(Ledger.user_id == current_user.id)
    )
    if not include_inactive:
        query = query.filter(Ledger.is_active == True)

    if group_id:
        query = query.filter(Ledger.ledger_group_id == group_id)

    ledgers = query.order_by(Ledger.ledger_group_id, Ledger.name).all()

    return ledgers


@router.get("/{ledger_id}", response_model=LedgerWithGroup)
async def get_ledger(
    ledger_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific ledger by ID."""
    ledger = (
        db.query(Ledger)
        .options(
            joinedload(Ledger.ledger_group).joinedload(LedgerGroup.parent_ledger_group),
        )
        .filter(Ledger.id == ledger_id, Ledger.user_id == current_user.id)
        .first()
    )

    if not ledger:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ledger not found",
        )

    return ledger


@router.put("/{ledger_id}", response_model=LedgerResponse)
async def update_ledger(
    ledger_id: int,
    ledger_data: LedgerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a ledger (account)."""
    ledger = db.query(Ledger).filter(Ledger.id == ledger_id, Ledger.user_id == current_user.id).first()

    if not ledger:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ledger not found",
        )

    # Verify ledger group exists
    ledger_group = (
        db.query(LedgerGroup)
        .filter(
            LedgerGroup.id == ledger_data.ledger_group_id,
            LedgerGroup.is_active == True,
        )
        .first()
    )

    if not ledger_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ledger group not found",
        )

    # Check for duplicate name (excluding current ledger)
    existing_ledger = (
        db.query(Ledger)
        .filter(
            Ledger.name == ledger_data.name,
            Ledger.user_id == current_user.id,
            Ledger.id != ledger_id,
        )
        .first()
    )

    if existing_ledger:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ledger with this name already exists",
        )

    # Update ledger
    ledger.name = ledger_data.name
    ledger.ledger_group_id = ledger_data.ledger_group_id

    db.commit()
    db.refresh(ledger)

    return ledger


@router.delete("/{ledger_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ledger(
    ledger_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft delete a ledger (account) by setting is_active to False."""
    ledger = db.query(Ledger).filter(Ledger.id == ledger_id, Ledger.user_id == current_user.id).first()

    if not ledger:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ledger not found",
        )

    ledger.is_active = False
    db.commit()

    return None


@router.put("/groups/{group_id}", response_model=LedgerGroupResponse)
async def update_ledger_group(
    group_id: int,
    group_data: LedgerGroupCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a ledger group (universal)."""
    group = db.query(LedgerGroup).filter(LedgerGroup.id == group_id).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ledger group not found",
        )

    # Verify parent ledger group exists
    parent_group = (
        db.query(ParentLedgerGroup)
        .filter(
            ParentLedgerGroup.id == group_data.parent_ledger_group_id,
            ParentLedgerGroup.is_active == True,
        )
        .first()
    )

    if not parent_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent ledger group not found",
        )

    # Check for duplicate name (excluding current group)
    existing = db.query(LedgerGroup).filter(LedgerGroup.name == group_data.name, LedgerGroup.id != group_id).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ledger group with this name already exists",
        )

    # Update group
    group.name = group_data.name
    group.parent_ledger_group_id = group_data.parent_ledger_group_id
    group.category = group_data.category

    db.commit()
    db.refresh(group)

    return group


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ledger_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft delete a ledger group by setting is_active to False."""
    group = db.query(LedgerGroup).filter(LedgerGroup.id == group_id).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ledger group not found",
        )

    group.is_active = False
    db.commit()

    return None
