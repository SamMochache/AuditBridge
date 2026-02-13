from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .parsers.mpesa_parser import parse_mpesa_csv
from .services.reconciliation import reconcile_payment
from .models import Payment

class UploadMpesaCSV(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        school = request.user.school
        parse_mpesa_csv(file, school, request.user)

        # Reconcile all newly created payments
        for payment in Payment.objects.filter(status='PENDING', uploaded_by=request.user):
            reconcile_payment(payment)

        return Response({"success": "Payments uploaded and reconciled"}, status=status.HTTP_200_OK)
