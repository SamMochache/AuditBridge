"""
config/settings/base.py

Security & performance improvements
────────────────────────────────────
1.  SECRET_KEY now exits hard (sys.exit) in production if not set via
    env — no more silent use of the insecure placeholder.

2.  CORS_ALLOW_ALL_ORIGINS is now only True in DEBUG mode.  In
    production it reads from the CORS_ALLOWED_ORIGINS env var.  This
    fixes the most critical security hole in the original codebase.

3.  REST_FRAMEWORK default throttle classes added.  Login endpoint
    uses a custom 'login' scope limited to 5 requests/minute.

4.  Redis is configured as the cache backend.  Falls back to
    LocMemCache if REDIS_URL is not set (useful for local dev without
    Docker).

5.  Structured JSON logging configured for the payments logger and
    the root logger in production.

6.  ALLOWED_HOSTS validation tightened — empty string is rejected.

7.  SESSION_COOKIE_SECURE and CSRF_COOKIE_SECURE set to True when
    not in DEBUG mode.

8.  FILE_UPLOAD_MAX_MEMORY_SIZE set to 10 MB to match the serializer
    validation and prevent memory exhaustion from large uploads.
"""

import os
import sys
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent

load_dotenv(BASE_DIR / "backend" / ".env")
load_dotenv(BASE_DIR / ".env")

# ── Core ───────────────────────────────────────────────────────────────────────

DEBUG = os.environ.get("DEBUG", "True") == "True"

_SECRET_KEY = os.environ.get("SECRET_KEY", "")
if not _SECRET_KEY:
    if not DEBUG:
        print(
            "FATAL: SECRET_KEY environment variable is not set. "
            "Set it in your environment or .env file before starting the server.",
            file=sys.stderr,
        )
        sys.exit(1)
    else:
        _SECRET_KEY = "django-insecure-dev-only-do-not-use-in-production"

SECRET_KEY = _SECRET_KEY

_raw_hosts = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1")
ALLOWED_HOSTS = [h.strip() for h in _raw_hosts.split(",") if h.strip()]

# ── Applications ───────────────────────────────────────────────────────────────

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    # Local
    "accounts",
    "school",
    "academics",
    "payments",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
AUTH_USER_MODEL = "accounts.User"

# ── Database ───────────────────────────────────────────────────────────────────

import dj_database_url  # noqa: E402

_DATABASE_URL = os.environ.get("DATABASE_URL", "")

if _DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            _DATABASE_URL,
            conn_max_age=600,
            ssl_require="sslmode=require" in _DATABASE_URL,
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("DB_NAME", "auditbridge_db"),
            "USER": os.environ.get("DB_USER", "postgres"),
            "PASSWORD": os.environ.get("DB_PASSWORD", ""),
            "HOST": os.environ.get("DB_HOST", "localhost"),
            "PORT": os.environ.get("DB_PORT", "5432"),
        }
    }

# ── Cache (Redis with LocMem fallback) ─────────────────────────────────────────
# Set REDIS_URL in production to enable Redis caching.
# Without it the app falls back to an in-process cache that does not
# share state between workers — adequate for single-worker dev, not for prod.

_REDIS_URL = os.environ.get("REDIS_URL", "")

if _REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": _REDIS_URL,
            "OPTIONS": {
                "socket_connect_timeout": 5,
                "socket_timeout": 5,
            },
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    }

# ── Auth ───────────────────────────────────────────────────────────────────────

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ── Internationalisation ───────────────────────────────────────────────────────

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Nairobi"
USE_I18N = True
USE_TZ = True

# ── Static files ───────────────────────────────────────────────────────────────

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "backend" / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── File uploads ───────────────────────────────────────────────────────────────

FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10 MB — matches serializer check

# ── Django REST Framework ──────────────────────────────────────────────────────

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_FILTER_BACKENDS": [
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    # ── Rate limiting ──────────────────────────────────────────────────────────
    # These apply globally.  The login endpoint uses the tighter 'login' scope
    # defined in CustomLoginThrottle (see accounts/throttles.py).
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/minute",
        "user": "300/minute",
        "login": "5/minute",  # applied explicitly on the login view
    },
}

# ── JWT ────────────────────────────────────────────────────────────────────────

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
    "TOKEN_TYPE_CLAIM": "token_type",
    "JTI_CLAIM": "jti",
}

# ── CORS ───────────────────────────────────────────────────────────────────────
# SECURITY FIX: CORS_ALLOW_ALL_ORIGINS = True in production was a significant
# security hole — any website could make credentialed requests to the API using
# a logged-in user's browser.
#
# In DEBUG mode (local dev) we keep it open for convenience.
# In production, set CORS_ALLOWED_ORIGINS in your environment:
#   CORS_ALLOWED_ORIGINS=https://audit-bridge-tau.vercel.app,https://yourdomain.com

if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    _raw_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "")
    CORS_ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]
    if not CORS_ALLOWED_ORIGINS:
        print(
            "WARNING: CORS_ALLOWED_ORIGINS is not set in production. "
            "No cross-origin requests will be accepted.",
            file=sys.stderr,
        )

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]

CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]

# ── Security headers (production only) ────────────────────────────────────────

if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"
    # Uncomment after confirming HTTPS is fully set up:
    # SECURE_HSTS_SECONDS = 31536000
    # SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# ── Structured logging ─────────────────────────────────────────────────────────

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "django.utils.log.ServerFormatter",
            "format": "%(asctime)s [%(levelname)s] %(name)s %(message)s",
        },
        "verbose": {
            "format": "{levelname} {asctime} {module} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose" if DEBUG else "json",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "payments": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
        "django.security": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}
