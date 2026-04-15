import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException, NotFoundException
from app.database import get_db
from app.models.company import Company
from app.repositories.company import CompanyRepository
from app.schemas.company import CompanyCreate, CompanyResponse, CompanyUpdate

router = APIRouter(prefix="/companies", tags=["Companies"])


def require_superadmin(current_user=Depends(get_current_user)):
    if not current_user.is_superadmin:
        raise ForbiddenException("Superadmin access required")
    return current_user


@router.get("", response_model=list[CompanyResponse])
async def list_companies(
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_superadmin),
):
    repo = CompanyRepository(db)
    items, _ = await repo.list_all(limit=1000)
    return items


@router.post("", response_model=CompanyResponse, status_code=201)
async def create_company(
    data: CompanyCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_superadmin),
):
    repo = CompanyRepository(db)
    existing = await repo.get_by_slug(data.slug)
    if existing:
        from app.core.exceptions import ConflictException
        raise ConflictException("Company slug already taken")
    company = await repo.create(**data.model_dump())
    await db.commit()
    return company


@router.get("/me", response_model=CompanyResponse)
async def get_my_company(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    repo = CompanyRepository(db)
    company = await repo.get_by_id_active(current_user.company_id)
    if not company:
        raise NotFoundException("Company")
    return company


@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    # Own company or superadmin
    if not current_user.is_superadmin and current_user.company_id != company_id:
        raise ForbiddenException()
    repo = CompanyRepository(db)
    company = await repo.get_by_id(company_id)
    if not company:
        raise NotFoundException("Company")
    return company


@router.patch("/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: uuid.UUID,
    data: CompanyUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    if not current_user.is_superadmin and current_user.company_id != company_id:
        raise ForbiddenException()
    repo = CompanyRepository(db)
    company = await repo.get_by_id(company_id)
    if not company:
        raise NotFoundException("Company")
    updated = await repo.update(company, **data.model_dump(exclude_none=True))
    await db.commit()
    return updated


@router.delete("/{company_id}", status_code=204)
async def delete_company(
    company_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_superadmin),
):
    repo = CompanyRepository(db)
    company = await repo.get_by_id(company_id)
    if not company:
        raise NotFoundException("Company")
    await repo.delete(company)
    await db.commit()
