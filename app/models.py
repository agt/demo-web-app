from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=True)
    full_name = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="user")  # "admin" or "user"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    checkouts = relationship("Checkout", back_populates="user")


class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    serial_number = Column(String, nullable=True)
    location = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    policy = relationship("CheckoutPolicy", back_populates="equipment", uselist=False)
    checkouts = relationship("Checkout", back_populates="equipment")


class CheckoutPolicy(Base):
    __tablename__ = "checkout_policies"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), unique=True, nullable=False)
    # JSON string of day indices 0–6 (Mon–Sun); NULL means any day allowed
    allowed_days = Column(String, nullable=True)
    max_checkout_days = Column(Integer, default=7)
    # "all" or JSON string of user ID integers
    allowed_users = Column(String, default="all")
    updated_at = Column(DateTime, default=datetime.utcnow)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    equipment = relationship("Equipment", back_populates="policy")


class Checkout(Base):
    __tablename__ = "checkouts"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    checked_out_at = Column(DateTime, default=datetime.utcnow)
    due_date = Column(DateTime, nullable=False)
    returned_at = Column(DateTime, nullable=True)
    status = Column(String, default="active")  # "active" | "returned"
    notes = Column(String, nullable=True)

    equipment = relationship("Equipment", back_populates="checkouts")
    user = relationship("User", back_populates="checkouts")
