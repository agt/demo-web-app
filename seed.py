"""
Seed the database with an admin account, sample users, and sample equipment.
Run once: python seed.py
"""
from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app import models

Base.metadata.create_all(bind=engine)
db = SessionLocal()

if db.query(models.User).filter(models.User.username == "admin").first():
    print("Database already seeded — skipping.")
    db.close()
    exit()

# ── Users ────────────────────────────────────────────────────────────────────
admin = models.User(
    username="admin",
    email="admin@lab.local",
    full_name="Lab Administrator",
    password_hash=hash_password("admin123"),
    role="admin",
)
alice = models.User(
    username="alice",
    email="alice@lab.local",
    full_name="Alice Researcher",
    password_hash=hash_password("alice123"),
    role="user",
)
bob = models.User(
    username="bob",
    email="bob@lab.local",
    full_name="Bob Scientist",
    password_hash=hash_password("bob123"),
    role="user",
)
db.add_all([admin, alice, bob])
db.flush()

# ── Equipment ────────────────────────────────────────────────────────────────
items = [
    ("Olympus BX53 Microscope", "Fluorescence upright microscope", "SN-OLY-001", "Room 204"),
    ("Thermo Nanodrop 2000", "UV-Vis spectrophotometer for nucleic acid quantification", "SN-TD-002", "Room 208"),
    ("Bio-Rad CFX96 qPCR", "Real-time PCR system, 96-well", "SN-BR-003", "Room 210"),
    ("Beckman Allegra X-30", "Benchtop centrifuge, max 30,000 × g", "SN-BK-004", "Room 206"),
    ("Zeiss LSM 900 Confocal", "Laser scanning confocal microscope", "SN-ZS-005", "Imaging Suite"),
]

equipment_objs = []
for name, desc, serial, location in items:
    e = models.Equipment(
        name=name,
        description=desc,
        serial_number=serial,
        location=location,
        created_by_id=admin.id,
    )
    db.add(e)
    db.flush()

    # Default policy: any day, 7-day checkout, all users
    policy = models.CheckoutPolicy(
        equipment_id=e.id,
        allowed_days=None,
        max_checkout_days=7,
        allowed_users="all",
        updated_by_id=admin.id,
    )
    db.add(policy)
    equipment_objs.append(e)

# Confocal: weekdays only, 3-day max, restricted to admin & alice
import json
confocal_policy = equipment_objs[-1].policy
if confocal_policy:
    confocal_policy.allowed_days = json.dumps([0, 1, 2, 3, 4])  # Mon–Fri
    confocal_policy.max_checkout_days = 3

db.commit()
print("Seeded successfully.")
print("  admin / admin123  (Administrator)")
print("  alice / alice123  (User)")
print("  bob   / bob123    (User)")
db.close()
