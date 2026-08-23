from fastapi import FastAPI

# Initialisation de l'application FastAPI
app = FastAPI(
    title="Iceberg",
    description="Backend du comparateur VTC et services à Abidjan",
    version="1.0.0"
)

@app.get("/")
def home():
    """Route de test pour vérifier l'état du serveur."""
    return {
        "status": "online",
        "message": "Bienvenue sur l'API Iceberg",
        "city": "Abidjan"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
