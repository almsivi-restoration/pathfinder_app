from .ruleset_1e import RULESET_CONFIG_1E
from .ruleset_2e import RULESET_CONFIG_2E

RULESETS = {
    "1e": RULESET_CONFIG_1E,
    "2e": RULESET_CONFIG_2E,
}

def get_ruleset(ruleset_name: str):
    """Retrieve ruleset configuration by name."""
    return RULESETS.get(ruleset_name)
