from datetime import UTC, datetime
from uuid import uuid4

from .schemas import (
    ActiveBinsResponse,
    BinCloseRequest,
    BinCreateRequest,
    BinRecord,
    BinStatus,
    BinType,
    GarmentCondition,
    GarmentItem,
    GarmentSortRequest,
    SortGarmentResponse,
    SortingStatsResponse,
)


class SortingService:
    def __init__(self) -> None:
        self._bins: dict[str, BinRecord] = {}
        self._garments: list[GarmentItem] = []
        self._seed_initial_data()

    def _seed_initial_data(self) -> None:
        now = datetime.now(UTC)

        # Closed historical bins
        closed_resale = BinRecord(
            id="bin-rs-000",
            bin_code="BIN-RS-000",
            bin_type=BinType.RESALE,
            status=BinStatus.CLOSED,
            item_count=50,
            total_weight_kg=18.5,
            max_capacity=50,
            created_at=now,
            closed_at=now,
            notes="Completed batch - sent to direct resale staging",
        )
        closed_recycle = BinRecord(
            id="bin-rc-000",
            bin_code="BIN-RC-000",
            bin_type=BinType.RECYCLE,
            status=BinStatus.CLOSED,
            item_count=50,
            total_weight_kg=24.0,
            max_capacity=50,
            created_at=now,
            closed_at=now,
            notes="Completed batch - awaiting contractor pickup",
        )

        # Active bins ready for counter intake
        active_resale = BinRecord(
            id="bin-rs-001",
            bin_code="BIN-RS-001",
            bin_type=BinType.RESALE,
            status=BinStatus.ACTIVE,
            item_count=14,
            total_weight_kg=5.2,
            max_capacity=50,
            created_at=now,
            closed_at=None,
            notes="Active counter bin for good condition items",
        )
        active_recycle = BinRecord(
            id="bin-rc-001",
            bin_code="BIN-RC-001",
            bin_type=BinType.RECYCLE,
            status=BinStatus.ACTIVE,
            item_count=22,
            total_weight_kg=8.4,
            max_capacity=50,
            created_at=now,
            closed_at=None,
            notes="Active counter bin for worn/recyclable items",
        )

        self._bins[closed_resale.id] = closed_resale
        self._bins[closed_recycle.id] = closed_recycle
        self._bins[active_resale.id] = active_resale
        self._bins[active_recycle.id] = active_recycle

        # Prepopulate a few recent garments
        sample_items = [
            (
                "garment-001",
                GarmentCondition.GOOD_REUSABLE,
                "Tops",
                active_resale.id,
                active_resale.bin_code,
                0.35,
            ),
            (
                "garment-002",
                GarmentCondition.WORN_RECYCLABLE,
                "Bottoms",
                active_recycle.id,
                active_recycle.bin_code,
                0.60,
            ),
            (
                "garment-003",
                GarmentCondition.GOOD_REUSABLE,
                "Outerwear",
                active_resale.id,
                active_resale.bin_code,
                0.90,
            ),
            (
                "garment-004",
                GarmentCondition.WORN_RECYCLABLE,
                "Tops",
                active_recycle.id,
                active_recycle.bin_code,
                0.25,
            ),
        ]
        for item_id, condition, category, bin_id, bin_code, weight in sample_items:
            self._garments.append(
                GarmentItem(
                    id=item_id,
                    condition=condition,
                    category=category,
                    bin_id=bin_id,
                    bin_code=bin_code,
                    weight_kg=weight,
                    notes=None,
                    created_at=now,
                )
            )

    def get_all_bins(
        self, bin_type: BinType | None = None, status: BinStatus | None = None
    ) -> list[BinRecord]:
        results = list(self._bins.values())
        if bin_type:
            results = [b for b in results if b.bin_type == bin_type]
        if status:
            results = [b for b in results if b.status == status]
        return sorted(results, key=lambda b: b.created_at, reverse=True)

    def get_active_bins(self) -> ActiveBinsResponse:
        resale_bin: BinRecord | None = None
        recycle_bin: BinRecord | None = None

        for b in self._bins.values():
            if b.status == BinStatus.ACTIVE:
                if b.bin_type == BinType.RESALE and resale_bin is None:
                    resale_bin = b
                elif b.bin_type == BinType.RECYCLE and recycle_bin is None:
                    recycle_bin = b

        return ActiveBinsResponse(resale_bin=resale_bin, recycle_bin=recycle_bin)

    def get_bin(self, bin_id: str) -> BinRecord | None:
        return self._bins.get(bin_id)

    def create_bin(self, request: BinCreateRequest) -> BinRecord:
        now = datetime.now(UTC)
        prefix = "RS" if request.bin_type == BinType.RESALE else "RC"
        type_count = sum(1 for b in self._bins.values() if b.bin_type == request.bin_type)
        bin_code = request.bin_code or f"BIN-{prefix}-{type_count + 1:03d}"
        bin_id = f"bin-{prefix.lower()}-{uuid4().hex[:6]}"

        new_bin = BinRecord(
            id=bin_id,
            bin_code=bin_code,
            bin_type=request.bin_type,
            status=BinStatus.ACTIVE,
            item_count=0,
            total_weight_kg=0.0,
            max_capacity=request.max_capacity,
            created_at=now,
            closed_at=None,
            notes=request.notes,
        )
        self._bins[bin_id] = new_bin
        return new_bin

    def close_bin(self, bin_id: str, request: BinCloseRequest) -> BinRecord | None:
        bin_record = self._bins.get(bin_id)
        if not bin_record:
            return None

        bin_record.status = BinStatus.CLOSED
        bin_record.closed_at = datetime.now(UTC)
        if request.notes:
            bin_record.notes = (
                f"{bin_record.notes}; {request.notes}" if bin_record.notes else request.notes
            )

        return bin_record

    def sort_garment(self, request: GarmentSortRequest) -> SortGarmentResponse:
        target_bin_type = (
            BinType.RESALE
            if request.condition == GarmentCondition.GOOD_REUSABLE
            else BinType.RECYCLE
        )

        target_bin: BinRecord | None = None

        if request.bin_id:
            candidate = self._bins.get(request.bin_id)
            if (
                candidate
                and candidate.status == BinStatus.ACTIVE
                and candidate.bin_type == target_bin_type
            ):
                target_bin = candidate

        if not target_bin:
            active_bins = self.get_active_bins()
            target_bin = (
                active_bins.resale_bin
                if target_bin_type == BinType.RESALE
                else active_bins.recycle_bin
            )

        # If no active bin of this type exists, automatically spawn a new one
        if not target_bin:
            target_bin = self.create_bin(
                BinCreateRequest(
                    bin_type=target_bin_type,
                    notes="Auto-created when incoming garment was sorted",
                )
            )

        now = datetime.now(UTC)
        item_id = f"gmt-{uuid4().hex[:8]}"
        garment = GarmentItem(
            id=item_id,
            condition=request.condition,
            category=request.category,
            bin_id=target_bin.id,
            bin_code=target_bin.bin_code,
            weight_kg=request.weight_kg,
            notes=request.notes,
            created_at=now,
        )

        target_bin.item_count += 1
        if request.weight_kg:
            target_bin.total_weight_kg = round(target_bin.total_weight_kg + request.weight_kg, 2)

        self._garments.insert(0, garment)

        condition_label = (
            "Good/Reusable (Resale)"
            if request.condition == GarmentCondition.GOOD_REUSABLE
            else "Worn/Recyclable (Recycle)"
        )
        message = (
            f"Item successfully sorted as {condition_label} into {target_bin.bin_code} "
            f"({target_bin.item_count}/{target_bin.max_capacity} items)."
        )

        return SortGarmentResponse(garment=garment, bin=target_bin, message=message)

    def get_recent_garments(self, limit: int = 15) -> list[GarmentItem]:
        return self._garments[:limit]

    def get_stats(self) -> SortingStatsResponse:
        total = len(self._garments)
        resale_count = sum(
            1 for g in self._garments if g.condition == GarmentCondition.GOOD_REUSABLE
        )
        recycle_count = sum(
            1 for g in self._garments if g.condition == GarmentCondition.WORN_RECYCLABLE
        )
        pct = round((resale_count / total * 100), 1) if total > 0 else 0.0

        active_bins = self.get_active_bins()

        return SortingStatsResponse(
            total_sorted_today=total,
            resale_count=resale_count,
            recycle_count=recycle_count,
            resale_percentage=pct,
            active_resale_bin_code=(
                active_bins.resale_bin.bin_code if active_bins.resale_bin else None
            ),
            active_resale_bin_items=(
                active_bins.resale_bin.item_count if active_bins.resale_bin else 0
            ),
            active_recycle_bin_code=(
                active_bins.recycle_bin.bin_code if active_bins.recycle_bin else None
            ),
            active_recycle_bin_items=(
                active_bins.recycle_bin.item_count if active_bins.recycle_bin else 0
            ),
        )


sorting_service = SortingService()
