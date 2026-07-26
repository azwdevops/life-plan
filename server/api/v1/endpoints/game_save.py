from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from api.v1.endpoints.auth import get_current_user
from core.database import get_db
from models.game_save import GameSave
from models.user import User
from schemas.game_save import GameSaveOut, GameSavePut

router = APIRouter()


@router.get(
    "/game-save",
    response_model=GameSaveOut,
)
async def get_game_save(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(GameSave)
        .filter(GameSave.user_id == current_user.id)
        .first()
    )
    if not row:
        return GameSaveOut(state={})
    return GameSaveOut(state=dict(row.state_json))


@router.put(
    "/game-save",
    response_model=GameSaveOut,
    status_code=status.HTTP_200_OK,
)
async def put_game_save(
    body: GameSavePut,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(GameSave)
        .filter(GameSave.user_id == current_user.id)
        .first()
    )
    payload = dict(body.state)
    if row:
        row.state_json = payload
    else:
        row = GameSave(user_id=current_user.id, state_json=payload)
        db.add(row)
    db.commit()
    db.refresh(row)
    return GameSaveOut(state=dict(row.state_json))
