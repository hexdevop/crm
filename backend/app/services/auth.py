import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictException,
    InvalidCredentialsException,
    UnauthorizedException,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.company import Company
from app.models.user import User
from app.repositories.company import CompanyRepository
from app.repositories.role import RoleRepository
from app.repositories.user import UserRepository
from app.schemas.auth import RegisterRequest

# Permission codes for system roles
OWNER_PERMISSIONS = [
    "create", "read", "update", "delete",
    "manage_users", "manage_roles", "manage_entities",
]
ADMIN_PERMISSIONS = [
    "create", "read", "update", "delete",
    "manage_users", "manage_roles", "manage_entities",
]
MANAGER_PERMISSIONS = ["create", "read", "update", "delete"]
EMPLOYEE_PERMISSIONS = ["create", "read", "update"]

REFRESH_TOKEN_PREFIX = "refresh:"


class AuthService:
    def __init__(self, db: AsyncSession, redis):
        self.db = db
        self.redis = redis

    async def register(self, data: RegisterRequest) -> User:
        company_repo = CompanyRepository(self.db)
        user_repo = UserRepository(self.db)
        role_repo = RoleRepository(self.db)

        # Check slug uniqueness
        existing_company = await company_repo.get_by_slug(data.company_slug)
        if existing_company:
            raise ConflictException("Company slug already taken")

        # Check email uniqueness
        existing_user = await user_repo.get_by_email(data.email)
        if existing_user:
            raise ConflictException("Email already registered")

        # Create company
        company = await company_repo.create(
            name=data.company_name,
            slug=data.company_slug,
        )

        # Create system permissions if they don't exist
        await self._ensure_permissions(role_repo)

        # Create system roles for the company
        owner_role = await self._create_system_role(
            role_repo, company.id, "Owner", "owner", OWNER_PERMISSIONS
        )

        # Create owner user
        user = await user_repo.create(
            company_id=company.id,
            email=data.email.lower(),
            hashed_password=hash_password(data.password),
            first_name=data.first_name,
            last_name=data.last_name,
        )

        # Assign owner role
        await role_repo.assign_role_to_user(user.id, owner_role.id, None)

        # Create other default roles
        await self._create_system_role(
            role_repo, company.id, "Admin", "admin", ADMIN_PERMISSIONS
        )
        await self._create_system_role(
            role_repo, company.id, "Manager", "manager", MANAGER_PERMISSIONS
        )
        await self._create_system_role(
            role_repo, company.id, "Employee", "employee", EMPLOYEE_PERMISSIONS
        )

        await self.db.commit()
        return user

    async def login(self, email: str, password: str) -> tuple[str, str]:
        user_repo = UserRepository(self.db)
        user = await user_repo.get_by_email(email.lower())

        if not user or not verify_password(password, user.hashed_password):
            raise InvalidCredentialsException()

        if not user.is_active:
            from app.core.exceptions import AccountDisabledException
            raise AccountDisabledException()

        access_token = create_access_token(
            {"sub": str(user.id), "company_id": str(user.company_id) if user.company_id else None}
        )
        refresh_token, expires = create_refresh_token()

        # Store refresh token in Redis
        key = f"{REFRESH_TOKEN_PREFIX}{refresh_token}"
        ttl = int((expires - datetime.now(timezone.utc)).total_seconds())
        await self.redis.setex(key, ttl, str(user.id))

        return access_token, refresh_token

    async def refresh(self, refresh_token: str) -> tuple[str, str]:
        key = f"{REFRESH_TOKEN_PREFIX}{refresh_token}"
        user_id_str = await self.redis.get(key)

        if not user_id_str:
            raise UnauthorizedException("Refresh token invalid or expired")

        user_repo = UserRepository(self.db)
        user = await user_repo.get_by_id_with_roles(uuid.UUID(user_id_str))

        if not user or not user.is_active:
            await self.redis.delete(key)
            raise UnauthorizedException("User not found or inactive")

        # Rotate: delete old, issue new
        await self.redis.delete(key)

        access_token = create_access_token(
            {"sub": str(user.id), "company_id": str(user.company_id) if user.company_id else None}
        )
        new_refresh, expires = create_refresh_token()
        new_key = f"{REFRESH_TOKEN_PREFIX}{new_refresh}"
        ttl = int((expires - datetime.now(timezone.utc)).total_seconds())
        await self.redis.setex(new_key, ttl, str(user.id))

        return access_token, new_refresh

    async def logout(self, refresh_token: str) -> None:
        key = f"{REFRESH_TOKEN_PREFIX}{refresh_token}"
        await self.redis.delete(key)

    async def _ensure_permissions(self, role_repo: RoleRepository) -> None:
        from app.models.role import Permission
        from sqlalchemy import select

        all_codes = set(
            OWNER_PERMISSIONS
            + ADMIN_PERMISSIONS
            + MANAGER_PERMISSIONS
            + EMPLOYEE_PERMISSIONS
        )
        for code in all_codes:
            existing = await role_repo.get_permission_by_code(code)
            if not existing:
                perm = Permission(
                    code=code,
                    description=f"Permission: {code}",
                )
                self.db.add(perm)
        await self.db.flush()

    async def _create_system_role(
        self,
        role_repo: RoleRepository,
        company_id: uuid.UUID,
        name: str,
        system_type: str,
        permission_codes: list[str],
    ):
        from app.models.role import Role

        role = Role(
            company_id=company_id,
            name=name,
            is_system=True,
            system_type=system_type,
        )
        self.db.add(role)
        await self.db.flush()

        # Assign permissions
        perms = []
        for code in permission_codes:
            perm = await role_repo.get_permission_by_code(code)
            if perm:
                perms.append(perm)
        if perms:
            await role_repo.replace_permissions(role, perms)

        return role
