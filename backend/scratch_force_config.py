import asyncio
import yaml
from app.settings import Settings
from app.runtime import AppRuntime

async def main():
    settings = Settings()
    rt = AppRuntime(settings)
    
    with open(rt.config_loader._seed_path, encoding="utf-8") as f:
        raw = yaml.safe_load(f)
        
    rt.config_loader.update(raw)
    print("Config updated in DB from YAML!")

if __name__ == "__main__":
    asyncio.run(main())
