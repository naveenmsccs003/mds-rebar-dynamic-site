"""
Auth-flow API exceptions. Each carries an `envelope_code` so
`config.api_exceptions` renders a specific machine-readable code the SPA
can branch on, rather than a generic status-derived one.
"""
from rest_framework import exceptions, status


class InvalidCredentials(exceptions.AuthenticationFailed):
    """Wrong email/password, or an unknown/inactive account — deliberately
    indistinguishable so the endpoint is not a user-enumeration oracle."""

    envelope_code = "INVALID_CREDENTIALS"
    default_detail = "Invalid email or password."
    default_code = "invalid_credentials"


class AccountLocked(exceptions.APIException):
    """Account is inside its progressive brute-force lockout window."""

    status_code = status.HTTP_403_FORBIDDEN
    envelope_code = "ACCOUNT_LOCKED"
    default_detail = "This account is temporarily locked after repeated failed logins."
    default_code = "account_locked"

    def __init__(self, retry_after: int):
        self.envelope_extra = {"retry_after": retry_after}
        super().__init__()


class PasswordIncorrect(exceptions.ValidationError):
    """Supplied `current_password` did not match (password-change flow)."""

    envelope_code = "INVALID_CREDENTIALS"


class InvalidResetToken(exceptions.ValidationError):
    """Password-reset uid/token pair is malformed, expired, or already used."""

    envelope_code = "INVALID_RESET_TOKEN"
