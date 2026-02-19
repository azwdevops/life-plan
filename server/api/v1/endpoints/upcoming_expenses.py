from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import date

from core.database import get_db
from api.v1.endpoints.auth import get_current_user
from models.user import User
from models.finance import UpcomingExpense
from schemas.finance import (
    UpcomingExpenseCreate,
    UpcomingExpenseUpdate,
    UpcomingExpenseResponse,
)

router = APIRouter()


@router.post(
    "/",
    response_model=UpcomingExpenseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_upcoming_expense(
    expense_data: UpcomingExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new upcoming expense."""
    if not expense_data.name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expense name is required",
        )

    new_expense = UpcomingExpense(
        user_id=current_user.id,
        name=expense_data.name.strip(),
        amount=expense_data.amount,
        due_date=expense_data.due_date,
    )

    db.add(new_expense)
    db.commit()
    db.refresh(new_expense)

    return new_expense


@router.get("/", response_model=List[UpcomingExpenseResponse])
async def get_upcoming_expenses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all upcoming expenses for the current user."""
    expenses = (
        db.query(UpcomingExpense)
        .filter(UpcomingExpense.user_id == current_user.id)
        .order_by(UpcomingExpense.due_date.asc())
        .all()
    )

    return expenses


@router.get("/{expense_id}", response_model=UpcomingExpenseResponse)
async def get_upcoming_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific upcoming expense."""
    expense = (
        db.query(UpcomingExpense)
        .filter(UpcomingExpense.id == expense_id)
        .filter(UpcomingExpense.user_id == current_user.id)
        .first()
    )

    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upcoming expense not found",
        )

    return expense


@router.put("/{expense_id}", response_model=UpcomingExpenseResponse)
async def update_upcoming_expense(
    expense_id: int,
    expense_data: UpcomingExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an existing upcoming expense."""
    expense = (
        db.query(UpcomingExpense)
        .filter(UpcomingExpense.id == expense_id)
        .filter(UpcomingExpense.user_id == current_user.id)
        .first()
    )

    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upcoming expense not found",
        )

    if expense_data.name is not None:
        if not expense_data.name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Expense name cannot be empty",
            )
        expense.name = expense_data.name.strip()

    if expense_data.amount is not None:
        expense.amount = expense_data.amount

    if expense_data.due_date is not None:
        expense.due_date = expense_data.due_date

    db.commit()
    db.refresh(expense)

    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_upcoming_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an upcoming expense."""
    expense = (
        db.query(UpcomingExpense)
        .filter(UpcomingExpense.id == expense_id)
        .filter(UpcomingExpense.user_id == current_user.id)
        .first()
    )

    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upcoming expense not found",
        )

    db.delete(expense)
    db.commit()

    return None

