from fastapi import APIRouter
from app.api.v1 import auth, companies, users, roles, entities, entity_records, movements, telegram, access_expiration, uploads, exchange_rates

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(companies.router)
api_router.include_router(users.router)
api_router.include_router(roles.router)
api_router.include_router(entities.router)
api_router.include_router(entity_records.router)
api_router.include_router(movements.router)
api_router.include_router(telegram.router)
api_router.include_router(access_expiration.router)
api_router.include_router(uploads.router)
api_router.include_router(exchange_rates.router)
