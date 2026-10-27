from pydantic import BaseModel


class HealthCheck(BaseModel):
    status: str


class Greeting(BaseModel):
    message: str
