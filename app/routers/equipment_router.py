import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user, require_admin
from ..database import get_db

router = APIRouter(prefix="/api/equipment", tags=["equipment"])


def _policy_to_schema(policy: models.CheckoutPolicy) -> Optional[schemas.PolicyOut]:
    if not policy:
        return None
    allowed_days = json.loads(policy.allowed_days) if policy.allowed_days else None
    if policy.allowed_users and policy.allowed_users != "all":
        allowed_users = json.loads(policy.allowed_users)
    else:
        allowed_users = "all"
    return schemas.PolicyOut(
        id=policy.id,
        equipment_id=policy.equipment_id,
        allowed_days=allowed_days,
        max_checkout_days=policy.max_checkout_days,
        allowed_users=allowed_users,
        updated_at=policy.updated_at,
    )


def _is_available(equipment_id: int, db: Session) -> bool:
    return (
        db.query(models.Checkout)
        .filter(
            models.Checkout.equipment_id == equipment_id,
            models.Checkout.status == "active",
        )
        .first()
    ) is None


def _to_out(e: models.Equipment, db: Session) -> schemas.EquipmentOut:
    return schemas.EquipmentOut(
        id=e.id,
        name=e.name,
        description=e.description,
        serial_number=e.serial_number,
        location=e.location,
        is_active=e.is_active,
        created_at=e.created_at,
        policy=_policy_to_schema(e.policy),
        available=_is_available(e.id, db),
    )


@router.get("", response_model=List[schemas.EquipmentOut])
def list_equipment(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    items = db.query(models.Equipment).filter(models.Equipment.is_active == True).all()
    return [_to_out(e, db) for e in items]


@router.get("/{equipment_id}", response_model=schemas.EquipmentOut)
def get_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    e = db.query(models.Equipment).filter(models.Equipment.id == equipment_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return _to_out(e, db)


@router.post("", response_model=schemas.EquipmentOut, status_code=status.HTTP_201_CREATED)
def create_equipment(
    equipment_in: schemas.EquipmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    e = models.Equipment(
        name=equipment_in.name,
        description=equipment_in.description,
        serial_number=equipment_in.serial_number,
        location=equipment_in.location,
        created_by_id=current_user.id,
    )
    db.add(e)
    db.flush()

    p_data = equipment_in.policy or schemas.PolicyBase()
    policy = models.CheckoutPolicy(
        equipment_id=e.id,
        allowed_days=(
            json.dumps(p_data.allowed_days) if p_data.allowed_days is not None else None
        ),
        max_checkout_days=p_data.max_checkout_days,
        allowed_users=(
            json.dumps(p_data.allowed_users)
            if isinstance(p_data.allowed_users, list)
            else "all"
        ),
        updated_by_id=current_user.id,
    )
    db.add(policy)
    db.commit()
    db.refresh(e)
    return _to_out(e, db)


@router.put("/{equipment_id}", response_model=schemas.EquipmentOut)
def update_equipment(
    equipment_id: int,
    equipment_in: schemas.EquipmentUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    e = db.query(models.Equipment).filter(models.Equipment.id == equipment_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Equipment not found")
    for field, value in equipment_in.model_dump(exclude_unset=True).items():
        setattr(e, field, value)
    db.commit()
    db.refresh(e)
    return _to_out(e, db)


@router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    e = db.query(models.Equipment).filter(models.Equipment.id == equipment_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Equipment not found")
    e.is_active = False
    db.commit()


@router.put("/{equipment_id}/policy", response_model=schemas.PolicyOut)
def update_policy(
    equipment_id: int,
    policy_in: schemas.PolicyBase,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    e = db.query(models.Equipment).filter(models.Equipment.id == equipment_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Equipment not found")

    policy = e.policy
    if not policy:
        policy = models.CheckoutPolicy(equipment_id=equipment_id)
        db.add(policy)

    policy.allowed_days = (
        json.dumps(policy_in.allowed_days) if policy_in.allowed_days is not None else None
    )
    policy.max_checkout_days = policy_in.max_checkout_days
    policy.allowed_users = (
        json.dumps(policy_in.allowed_users)
        if isinstance(policy_in.allowed_users, list)
        else "all"
    )
    policy.updated_at = datetime.utcnow()
    policy.updated_by_id = current_user.id

    db.commit()
    db.refresh(policy)
    return _policy_to_schema(policy)
