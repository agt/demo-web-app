import json
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user, require_admin
from ..database import get_db

router = APIRouter(prefix="/api/checkouts", tags=["checkouts"])

_DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _to_out(c: models.Checkout) -> dict:
    return {
        "id": c.id,
        "equipment_id": c.equipment_id,
        "user_id": c.user_id,
        "checked_out_at": c.checked_out_at,
        "due_date": c.due_date,
        "returned_at": c.returned_at,
        "status": c.status,
        "notes": c.notes,
        "equipment": (
            {
                "id": c.equipment.id,
                "name": c.equipment.name,
                "description": c.equipment.description,
                "serial_number": c.equipment.serial_number,
                "location": c.equipment.location,
            }
            if c.equipment
            else None
        ),
        "user": (
            {
                "id": c.user.id,
                "username": c.user.username,
                "full_name": c.user.full_name,
                "email": c.user.email,
            }
            if c.user
            else None
        ),
    }


@router.get("", response_model=List[schemas.CheckoutOut])
def list_checkouts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.Checkout)
    if current_user.role != "admin":
        q = q.filter(models.Checkout.user_id == current_user.id)
    return [_to_out(c) for c in q.order_by(models.Checkout.checked_out_at.desc()).all()]


@router.post("", response_model=schemas.CheckoutOut, status_code=status.HTTP_201_CREATED)
def create_checkout(
    checkout_in: schemas.CheckoutCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    e = (
        db.query(models.Equipment)
        .filter(
            models.Equipment.id == checkout_in.equipment_id,
            models.Equipment.is_active == True,
        )
        .first()
    )
    if not e:
        raise HTTPException(status_code=404, detail="Equipment not found")

    active = (
        db.query(models.Checkout)
        .filter(
            models.Checkout.equipment_id == checkout_in.equipment_id,
            models.Checkout.status == "active",
        )
        .first()
    )
    if active:
        raise HTTPException(status_code=409, detail="Equipment is currently checked out")

    max_days = 7
    policy = e.policy
    if policy:
        if policy.allowed_days:
            allowed = json.loads(policy.allowed_days)
            today = datetime.utcnow().weekday()  # 0=Mon, 6=Sun
            if today not in allowed:
                names = [_DAY_NAMES[d] for d in sorted(allowed)]
                raise HTTPException(
                    status_code=400,
                    detail=f"Checkouts only allowed on: {', '.join(names)}",
                )

        if policy.allowed_users and policy.allowed_users != "all":
            allowed_ids = json.loads(policy.allowed_users)
            if current_user.id not in allowed_ids:
                raise HTTPException(
                    status_code=403,
                    detail="You are not authorized to check out this equipment",
                )

        max_days = policy.max_checkout_days

    checkout = models.Checkout(
        equipment_id=checkout_in.equipment_id,
        user_id=current_user.id,
        due_date=datetime.utcnow() + timedelta(days=max_days),
        notes=checkout_in.notes,
        status="active",
    )
    db.add(checkout)
    db.commit()
    db.refresh(checkout)
    return _to_out(checkout)


@router.put("/{checkout_id}/return", response_model=schemas.CheckoutOut)
def return_checkout(
    checkout_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    checkout = db.query(models.Checkout).filter(models.Checkout.id == checkout_id).first()
    if not checkout:
        raise HTTPException(status_code=404, detail="Checkout not found")
    if checkout.status != "active":
        raise HTTPException(status_code=400, detail="Checkout already returned")
    if current_user.role != "admin" and checkout.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    checkout.returned_at = datetime.utcnow()
    checkout.status = "returned"
    db.commit()
    db.refresh(checkout)
    return _to_out(checkout)
