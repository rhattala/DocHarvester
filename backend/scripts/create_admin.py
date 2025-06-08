#!/usr/bin/env python3
"""
Create default admin user for DocHarvester
"""
import asyncio
import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import AsyncSessionLocal
from backend.models import User
from backend.api.auth import get_password_hash

DEFAULT_ADMIN_EMAIL = "admin@docharvester.com"
DEFAULT_ADMIN_PASSWORD = "admin123"

async def create_admin_user():
    """Create or reset the default admin user"""
    try:
        async with AsyncSessionLocal() as session:
            # Check if admin user exists
            result = await session.execute(
                text("SELECT * FROM users WHERE email = :email"),
                {"email": DEFAULT_ADMIN_EMAIL}
            )
            admin = result.scalar_one_or_none()
            
            if admin:
                print(f"Admin user '{DEFAULT_ADMIN_EMAIL}' already exists.")
                
                # Update password to ensure it's correct
                await session.execute(
                    text("UPDATE users SET hashed_password = :password WHERE email = :email"),
                    {
                        "password": get_password_hash(DEFAULT_ADMIN_PASSWORD),
                        "email": DEFAULT_ADMIN_EMAIL
                    }
                )
                await session.commit()
                print("Admin password has been reset to default.")
            else:
                # Create new admin user
                admin = User(
                    email=DEFAULT_ADMIN_EMAIL,
                    hashed_password=get_password_hash(DEFAULT_ADMIN_PASSWORD),
                    full_name="Admin User",
                    is_active=True,
                    is_admin=True
                )
                session.add(admin)
                await session.commit()
                print(f"Default admin user created successfully!")
            
            print(f"\nDefault Admin Credentials:")
            print(f"Email: {DEFAULT_ADMIN_EMAIL}")
            print(f"Password: {DEFAULT_ADMIN_PASSWORD}")
            print(f"\n⚠️  Please change the default password after first login!")
            
    except Exception as e:
        print(f"Error creating admin user: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(create_admin_user()) 