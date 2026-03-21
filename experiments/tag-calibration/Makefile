.PHONY: all phase1 phase2 phase3 phase4 test storybook clean setup

PYTHON = uv run python

all: phase1 phase2 phase3 phase4

setup:
	uv sync
	@echo "Ensure Ollama is running: ollama serve"
	@echo "Ensure Gemma is pulled: ollama pull gemma3:12b"

phase1:  ## Taxonomy Discovery
	$(PYTHON) -m src.phase1_taxonomy.fetch_cards
	$(PYTHON) -m src.phase1_taxonomy.discover

phase2:  ## Gold Tagging
	$(PYTHON) -m src.phase2_gold.tagger

phase3:  ## DSPy Calibration
	$(PYTHON) -m src.phase3_dspy.optimize

phase4:  ## Validation
	$(PYTHON) -m src.phase4_validation.evaluate
	$(PYTHON) -m src.phase4_validation.report

test:  ## Run tests
	$(PYTHON) -m pytest tests/ -v

test-integration:  ## Run integration tests (requires live APIs)
	$(PYTHON) -m pytest tests/ -v -m integration

storybook:  ## Start Storybook dev server
	cd storybook && npm install && npm run storybook

clean:  ## Remove generated data
	rm -rf data/*.json data/optimized_prompts/*.json

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
