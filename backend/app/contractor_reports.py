from decimal import Decimal

from fastapi import APIRouter

from .schemas import (
    ContractorReportValidationRequest,
    ContractorReportValidationResponse,
    ContractorReportValidationRowRequest,
    ContractorReportValidationRowResult,
)

router = APIRouter(prefix="/api/contractor-reports", tags=["contractor reports"])


def validate_report_row(
    report_row: ContractorReportValidationRowRequest,
) -> ContractorReportValidationRowResult:
    dispositions = report_row.dispositions
    categorized_weight = sum(
        (
            dispositions.upcycled_kg,
            dispositions.fibre_to_fibre_kg,
            dispositions.downcycled_kg,
            dispositions.exported_kg,
            dispositions.landfilled_kg,
            dispositions.incinerated_energy_recovery_kg,
        ),
        start=Decimal("0"),
    )

    errors: list[str] = []
    if categorized_weight > report_row.received_kg:
        excess_weight = categorized_weight - report_row.received_kg
        errors.append(
            "Disposition weights exceed received weight by "
            f"{excess_weight.quantize(Decimal('0.001'))} kg."
        )

    uncategorized_weight = max(
        Decimal("0"),
        report_row.received_kg - categorized_weight,
    )
    return ContractorReportValidationRowResult(
        row=report_row.row,
        categorized_weight_kg=float(categorized_weight),
        uncategorized_weight_kg=float(uncategorized_weight),
        is_valid=not errors,
        errors=errors,
    )


@router.post("/validate", response_model=ContractorReportValidationResponse)
async def validate_contractor_report(
    request: ContractorReportValidationRequest,
) -> ContractorReportValidationResponse:
    return ContractorReportValidationResponse(
        rows=[validate_report_row(report_row) for report_row in request.rows]
    )
