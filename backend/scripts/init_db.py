import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import AsyncSessionLocal
from backend.models import User
from backend.api.auth import get_password_hash

async def init_db():
    """Initialize database with default admin user"""
    async with AsyncSessionLocal() as session:
        # Check if admin user exists
        result = await session.execute(
            text("SELECT * FROM users WHERE email = 'admin@docharvester.com'")
        )
        admin = result.scalar_one_or_none()
        
        if not admin:
            # Create admin user
            admin = User(
                email="admin@docharvester.com",
                hashed_password=get_password_hash("admin123"),
                full_name="Admin User",
                is_active=True,
                is_admin=True
            )
            session.add(admin)
            await session.commit()
            print("Default admin user created successfully!")
        else:
            print("Admin user already exists.")

if __name__ == "__main__":
    asyncio.run(init_db()) 