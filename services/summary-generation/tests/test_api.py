"""API endpoint tests for the summary generation service."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from app.core.database import get_db, Base

# Test database URL
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


class TestHealthEndpoint:
    """Test health check endpoint."""
    
    def test_health_check(self):
        """Test health check returns successful response."""
        response = client.get("/health")
        assert response.status_code == 200
        
        data = response.json()
        assert "status" in data
        assert "timestamp" in data
        assert "version" in data
        assert "dependencies" in data


class TestLanguageEndpoints:
    """Test language support endpoints."""
    
    def test_get_supported_languages(self):
        """Test getting list of supported languages."""
        response = client.get("/languages")
        assert response.status_code == 200
        
        languages = response.json()
        assert isinstance(languages, list)
        assert len(languages) > 0
        
        # Check first language has required fields
        first_lang = languages[0]
        assert "code" in first_lang
        assert "name" in first_lang
        assert "native_name" in first_lang
        assert "supported_complexities" in first_lang
    
    def test_get_language_info(self):
        """Test getting specific language information."""
        response = client.get("/languages/de")
        assert response.status_code == 200
        
        lang_info = response.json()
        assert lang_info["code"] == "de"
        assert lang_info["name"] == "German"
        assert "supported_complexities" in lang_info
    
    def test_get_unsupported_language(self):
        """Test getting information for unsupported language."""
        response = client.get("/languages/xx")
        assert response.status_code == 404
    
    def test_get_cultural_contexts(self):
        """Test getting cultural contexts for a language."""
        response = client.get("/languages/de/cultural-contexts")
        assert response.status_code == 200
        
        contexts = response.json()
        assert "language" in contexts
        assert "cultural_contexts" in contexts
        assert contexts["language"] == "de"


class TestComplexityEndpoints:
    """Test complexity level endpoints."""
    
    def test_get_complexity_levels(self):
        """Test getting list of complexity levels."""
        response = client.get("/complexity-levels")
        assert response.status_code == 200
        
        levels = response.json()
        assert isinstance(levels, list)
        assert len(levels) > 0
        
        # Check first level has required fields
        first_level = levels[0]
        assert "level" in first_level
        assert "name" in first_level
        assert "description" in first_level
        assert "target_audience" in first_level
        assert "reading_level" in first_level
    
    def test_get_complexity_level_info(self):
        """Test getting specific complexity level information."""
        response = client.get("/complexity-levels/basic")
        assert response.status_code == 200
        
        level_info = response.json()
        assert level_info["level"] == "basic"
        assert level_info["name"] == "Basic"
        assert "description" in level_info
    
    def test_get_unsupported_complexity_level(self):
        """Test getting information for unsupported complexity level."""
        response = client.get("/complexity-levels/invalid")
        assert response.status_code == 404
    
    def test_get_complexity_examples(self):
        """Test getting complexity level examples."""
        response = client.get("/complexity-levels/basic/examples")
        assert response.status_code == 200
        
        examples = response.json()
        assert "level" in examples
        assert "examples" in examples
        assert examples["level"] == "basic"


class TestSummaryEndpoints:
    """Test summary generation and management endpoints."""
    
    def test_generate_summary_missing_api_key(self):
        """Test summary generation without OpenAI API key."""
        request_data = {
            "report_text": "Test medical report in German",
            "language": "en",
            "complexity_level": "basic"
        }
        
        response = client.post("/generate-summary", json=request_data)
        # Should fail without API key configured
        assert response.status_code in [503, 500]
    
    def test_generate_summary_invalid_language(self):
        """Test summary generation with invalid language."""
        request_data = {
            "report_text": "Test medical report",
            "language": "invalid",
            "complexity_level": "basic"
        }
        
        response = client.post("/generate-summary", json=request_data)
        assert response.status_code == 422  # Validation error
    
    def test_generate_summary_invalid_complexity(self):
        """Test summary generation with invalid complexity level."""
        request_data = {
            "report_text": "Test medical report",
            "language": "en",
            "complexity_level": "invalid"
        }
        
        response = client.post("/generate-summary", json=request_data)
        assert response.status_code == 422  # Validation error
    
    def test_generate_summary_empty_text(self):
        """Test summary generation with empty report text."""
        request_data = {
            "report_text": "",
            "language": "en",
            "complexity_level": "basic"
        }
        
        response = client.post("/generate-summary", json=request_data)
        assert response.status_code == 422  # Validation error
    
    def test_list_summaries(self):
        """Test listing summaries."""
        response = client.get("/summaries")
        assert response.status_code == 200
        
        summaries = response.json()
        assert "summaries" in summaries
        assert "total" in summaries
        assert "page" in summaries
        assert "page_size" in summaries
        assert "has_next" in summaries
    
    def test_list_summaries_with_filters(self):
        """Test listing summaries with filters."""
        response = client.get("/summaries?language=de&complexity_level=basic&page=1&page_size=10")
        assert response.status_code == 200
        
        summaries = response.json()
        assert "summaries" in summaries
    
    def test_get_nonexistent_summary(self):
        """Test getting a nonexistent summary."""
        fake_uuid = "550e8400-e29b-41d4-a716-446655440000"
        response = client.get(f"/summaries/{fake_uuid}")
        assert response.status_code == 404
    
    def test_update_nonexistent_summary(self):
        """Test updating a nonexistent summary."""
        fake_uuid = "550e8400-e29b-41d4-a716-446655440000"
        update_data = {
            "language": "de"
        }
        
        response = client.put(f"/summaries/{fake_uuid}", json=update_data)
        assert response.status_code == 404
    
    def test_delete_nonexistent_summary(self):
        """Test deleting a nonexistent summary."""
        fake_uuid = "550e8400-e29b-41d4-a716-446655440000"
        response = client.delete(f"/summaries/{fake_uuid}")
        assert response.status_code == 404
    
    def test_submit_feedback_nonexistent_summary(self):
        """Test submitting feedback for nonexistent summary."""
        fake_uuid = "550e8400-e29b-41d4-a716-446655440000"
        feedback_data = {
            "summary_id": fake_uuid,
            "overall_rating": 5,
            "comments": "Great summary!"
        }
        
        response = client.post(f"/summaries/{fake_uuid}/feedback", json=feedback_data)
        assert response.status_code == 404


class TestRootEndpoint:
    """Test root endpoint."""
    
    def test_root_endpoint(self):
        """Test root endpoint returns service information."""
        response = client.get("/")
        assert response.status_code == 200
        
        data = response.json()
        assert "service" in data
        assert "version" in data
        assert "status" in data
        assert data["status"] == "active"


# Cleanup after tests
@pytest.fixture(scope="session", autouse=True)
def cleanup():
    """Cleanup test database after all tests."""
    yield
    import os
    if os.path.exists("test.db"):
        os.remove("test.db")