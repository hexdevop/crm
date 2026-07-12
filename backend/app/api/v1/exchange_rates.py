from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user
from app.services.exchange_rates import get_exchange_rates

router = APIRouter(prefix="/exchange-rates", tags=["Exchange Rates"])


@router.get("")
async def read_exchange_rates(_current_user=Depends(get_current_user)):
    return {"base": "USD", "rates": await get_exchange_rates()}
