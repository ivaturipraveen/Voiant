import asyncio
from app.runtime import AppRuntime
from app.settings import Settings
from app.services import dashboard_service

async def main():
    try:
        settings = Settings()
        rt = AppRuntime(settings)
        rt.bootstrap_synthetic()
        res = dashboard_service.recommendations_overview(rt, "admin")
        print("Success:", res.run_id)
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(main())
