from fastapi import APIRouter

from api.v1.endpoints import test, auth, accounts, transactions, reports, feedback, upcoming_expenses, game, run_sessions, investments, resumes

api_router = APIRouter()
api_router.include_router(test.router, prefix="/test", tags=["test"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(accounts.router, prefix="/accounts", tags=["accounts"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(feedback.router, prefix="/feedback", tags=["feedback"])
api_router.include_router(upcoming_expenses.router, prefix="/upcoming-expenses", tags=["upcoming-expenses"])
api_router.include_router(game.router, prefix="/game", tags=["game"])
api_router.include_router(run_sessions.router, prefix="/run-sessions", tags=["run-sessions"])
api_router.include_router(investments.router, prefix="/investments", tags=["investments"])
api_router.include_router(resumes.router, prefix="/resumes", tags=["resumes"])

