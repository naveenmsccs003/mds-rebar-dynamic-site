"""
No models here by design. `apps.users.User` is the actual account
record; this app holds the auth *flow* (login, logout, password reset,
email verification — Phase 3) which uses Django's built-in
`PasswordResetTokenGenerator` rather than a stored-token model.
"""
