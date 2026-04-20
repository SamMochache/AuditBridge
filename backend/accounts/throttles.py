"""
accounts/throttles.py

A dedicated throttle class for the login endpoint.
Applied at 5 requests/minute per IP — tight enough to prevent
brute-force attacks while not blocking legitimate multi-tab usage.
"""

from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """
    5 login attempts per minute per IP address.
    The scope name 'login' must match DEFAULT_THROTTLE_RATES in settings.
    """

    scope = "login"
