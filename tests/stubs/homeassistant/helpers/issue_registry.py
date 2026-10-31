"""Minimal issue registry stub."""
from enum import StrEnum

ISSUES: dict = {}


class IssueSeverity(StrEnum):
    CRITICAL = "critical"
    ERROR = "error"
    WARNING = "warning"


def async_create_issue(hass, domain, issue_id, **kw):
    ISSUES[(domain, issue_id)] = kw


def async_delete_issue(hass, domain, issue_id):
    ISSUES.pop((domain, issue_id), None)
