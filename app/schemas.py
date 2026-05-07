from datetime import datetime
from typing import List, Optional, Union
from pydantic import BaseModel, Field


# ── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── Users ────────────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: str = "user"

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class UserOut(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Checkout Policy ───────────────────────────────────────────────────────────

class PolicyBase(BaseModel):
    # None means any day; list of 0–6 restricts to those days (0=Mon, 6=Sun)
    allowed_days: Optional[List[int]] = None
    max_checkout_days: int = Field(default=7, ge=1, le=365)
    # "all" or list of user IDs
    allowed_users: Union[str, List[int]] = "all"

class PolicyOut(PolicyBase):
    id: int
    equipment_id: int
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Equipment ─────────────────────────────────────────────────────────────────

class EquipmentBase(BaseModel):
    name: str
    description: Optional[str] = None
    serial_number: Optional[str] = None
    location: Optional[str] = None

class EquipmentCreate(EquipmentBase):
    policy: Optional[PolicyBase] = None

class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    serial_number: Optional[str] = None
    location: Optional[str] = None
    is_active: Optional[bool] = None

class EquipmentOut(EquipmentBase):
    id: int
    is_active: bool
    created_at: datetime
    policy: Optional[PolicyOut] = None
    available: Optional[bool] = None

    model_config = {"from_attributes": True}


# ── Checkouts ─────────────────────────────────────────────────────────────────

class CheckoutCreate(BaseModel):
    equipment_id: int
    notes: Optional[str] = None

class EquipmentSummary(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    serial_number: Optional[str] = None
    location: Optional[str] = None

class UserSummary(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None

class CheckoutOut(BaseModel):
    id: int
    equipment_id: int
    user_id: int
    checked_out_at: datetime
    due_date: datetime
    returned_at: Optional[datetime] = None
    status: str
    notes: Optional[str] = None
    equipment: Optional[EquipmentSummary] = None
    user: Optional[UserSummary] = None
