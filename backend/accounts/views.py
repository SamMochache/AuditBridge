"""
accounts/views.py

Changes from original
─────────────────────
1. CustomTokenObtainPairView now uses LoginRateThrottle — 5 attempts/minute
   per IP.  This prevents brute-force password attacks.

2. paybill_number added to the login response so the frontend can
   display it without a separate profile fetch.

3. UserRegistrationView restricted to ADMIN role — self-registration
   is disabled for a school finance system where users are created by
   administrators.  (Override via the Django admin if needed.)

4. UserListView now only returns users in the requesting user's school,
   regardless of role — no information leakage between schools.
"""

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from accounts.models import User
from accounts.throttles import LoginRateThrottle
from accounts.serializers import (
    ChangePasswordSerializer,
    UserRegistrationSerializer,
    UserSerializer,
)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["email"] = user.email
        token["role"] = user.role
        token["school_id"] = user.school.id if user.school else None
        token["school_name"] = user.school.name if user.school else None
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = {
            "id": self.user.id,
            "username": self.user.username,
            "email": self.user.email,
            "first_name": self.user.first_name,
            "last_name": self.user.last_name,
            "role": self.user.role,
            "school_id": self.user.school.id if self.user.school else None,
            "school_name": self.user.school.name if self.user.school else None,
            "paybill_number": (
                self.user.school.paybill_number if self.user.school else None
            ),
            "is_active": self.user.is_active,
            "date_joined": self.user.date_joined.isoformat(),
        }
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Login endpoint — rate-limited to 5 requests/minute per IP.
    Returns access + refresh tokens and a user info payload.
    """

    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle]


class UserRegistrationView(generics.CreateAPIView):
    """
    Create a new user.  Restricted to authenticated ADMIN users only —
    self-registration is disabled for a financial management system.
    """

    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        # Import here to avoid circular import
        from payments.views import IsAdminRole

        return [permissions.IsAuthenticated(), IsAdminRole()]

    def create(self, request, *args, **kwargs):
        # Enforce that the new user belongs to the same school as the admin
        data = request.data.copy()
        if request.user.school:
            data["school"] = request.user.school.id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                },
                "message": "User created successfully.",
            },
            status=status.HTTP_201_CREATED,
        )


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        if serializer.is_valid():
            user = request.user
            user.set_password(serializer.validated_data["new_password"])
            user.save()
            return Response(
                {"message": "Password changed successfully."},
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh_token")
            if not refresh_token:
                return Response(
                    {"error": "refresh_token is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(
                {"message": "Logged out successfully."},
                status=status.HTTP_200_OK,
            )
        except Exception:
            return Response(
                {"error": "Invalid or already expired token."},
                status=status.HTTP_400_BAD_REQUEST,
            )


class UserListView(generics.ListAPIView):
    """List users in the same school as the requesting user."""

    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Always scope to the requesting user's school — no cross-school leakage
        return User.objects.filter(school=self.request.user.school)
