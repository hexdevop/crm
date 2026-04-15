from fastapi import HTTPException, status


class AppException(HTTPException):
    """Base application exception with structured detail."""

    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(
            status_code=status_code,
            detail={"code": code, "message": message},
        )


# Auth
class UnauthorizedException(AppException):
    def __init__(self, message: str = "Not authenticated"):
        super().__init__(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", message)


class ForbiddenException(AppException):
    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(status.HTTP_403_FORBIDDEN, "FORBIDDEN", message)


class InvalidCredentialsException(AppException):
    def __init__(self):
        super().__init__(
            status.HTTP_401_UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid email or password"
        )


# Resource
class NotFoundException(AppException):
    def __init__(self, resource: str = "Resource"):
        super().__init__(
            status.HTTP_404_NOT_FOUND, "NOT_FOUND", f"{resource} not found"
        )


class ConflictException(AppException):
    def __init__(self, message: str):
        super().__init__(status.HTTP_409_CONFLICT, "CONFLICT", message)


class ValidationException(AppException):
    def __init__(self, message: str):
        super().__init__(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", message
        )


# Business
class AccessExpiredException(AppException):
    def __init__(self):
        super().__init__(
            status.HTTP_403_FORBIDDEN, "ACCESS_EXPIRED", "Your access has expired"
        )


class AccountDisabledException(AppException):
    def __init__(self):
        super().__init__(
            status.HTTP_403_FORBIDDEN, "ACCOUNT_DISABLED", "Account is disabled"
        )
