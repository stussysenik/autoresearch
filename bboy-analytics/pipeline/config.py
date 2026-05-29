import os

class Config:
    def __init__(self):
        # Data sources configuration
        self.sources = ["twitter", "reddit", "news_api"]
        self.date_range = ("2023-01-01", "2023-12-31")
        
        # Extraction settings
        self.batch_size = 100
        self.max_retries = 3
        
        # Output paths
        self.output_dir = "data/extracted"
        self.log_level = "INFO"

    def get_source_config(self, source):
        configs = {
            "twitter": {"api_version": "v2", "endpoints": ["tweets", "users"]},
            "reddit": {"api_version": "oauth", "endpoints": ["submissions", "comments"]},
            "news_api": {"api_version": "1.0", "endpoints": ["everything", "top-headlines"]}
        }
        return configs.get(source, {})

if __name__ == "__main__":
    config = Config()
    print(f"Config initialized with sources: {config.sources}")
