import uuid
from datetime import datetime
from pydantic import BaseModel


class PermissionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    code: str
    description: str | None


class RoleCreate(BaseModel):
    name: str
    description: str | None = None


class RoleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class RolePermissionsUpdate(BaseModel):
    permission_ids: list[uuid.UUID]


class RoleResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    description: str | None
    is_system: bool
    system_type: str | None
    permissions: list[PermissionResponse] = []
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm(cls, role) -> "RoleResponse":
        permissions = [
            PermissionResponse.model_validate(rp.permission)
            for rp in (role.role_permissions or [])
            if rp.permission
        ]
        return cls(
            id=role.id,
            company_id=role.company_id,
            name=role.name,
            description=role.description,
            is_system=role.is_system,
            system_type=role.system_type,
            permissions=permissions,
            created_at=role.created_at,
            updated_at=role.updated_at,
        )


class UserRoleAssign(BaseModel):
    role_id: uuid.UUID
