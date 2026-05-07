from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .database import Base, engine
from .routers import auth_router, checkouts_router, equipment_router, users_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Lab Equipment Checkout", version="1.0.0", docs_url="/api/docs")

app.include_router(auth_router.router)
app.include_router(users_router.router)
app.include_router(equipment_router.router)
app.include_router(checkouts_router.router)

app.mount("/", StaticFiles(directory="static", html=True), name="static")
