// Generated from tree_spec.authoring; do not edit.
export const AUTHORING_SCHEMA = {
    "$defs": {
        "AuthoringChoice": {
            "additionalProperties": false,
            "properties": {
                "feedback": {
                    "$ref": "#/$defs/AuthoringJsonValue"
                },
                "id": {
                    "maxLength": 80,
                    "minLength": 1,
                    "title": "Id",
                    "type": "string"
                },
                "label": {
                    "maxLength": 200,
                    "minLength": 1,
                    "title": "Label",
                    "type": "string"
                },
                "render_hints": {
                    "additionalProperties": {
                        "$ref": "#/$defs/AuthoringJsonValue"
                    },
                    "title": "Render Hints",
                    "type": "object"
                }
            },
            "required": [
                "id",
                "label"
            ],
            "title": "AuthoringChoice",
            "type": "object"
        },
        "AuthoringJsonValue": {
            "anyOf": [
                {
                    "type": "string"
                },
                {
                    "type": "boolean"
                },
                {
                    "maximum": 9007199254740991,
                    "minimum": -9007199254740991,
                    "type": "integer"
                },
                {
                    "maximum": 9007199254740991,
                    "minimum": -9007199254740991,
                    "type": "number"
                },
                {
                    "items": {
                        "$ref": "#/$defs/AuthoringJsonValue"
                    },
                    "type": "array"
                },
                {
                    "additionalProperties": {
                        "$ref": "#/$defs/AuthoringJsonValue"
                    },
                    "type": "object"
                },
                {
                    "type": "null"
                }
            ]
        },
        "AuthoringNode": {
            "additionalProperties": false,
            "properties": {
                "choices": {
                    "items": {
                        "$ref": "#/$defs/AuthoringChoice"
                    },
                    "title": "Choices",
                    "type": "array"
                },
                "prompt": {
                    "title": "Prompt",
                    "type": "string"
                },
                "render_hints": {
                    "additionalProperties": {
                        "$ref": "#/$defs/AuthoringJsonValue"
                    },
                    "title": "Render Hints",
                    "type": "object"
                },
                "type": {
                    "maxLength": 40,
                    "minLength": 1,
                    "title": "Type",
                    "type": "string"
                }
            },
            "required": [
                "type",
                "prompt",
                "choices"
            ],
            "title": "AuthoringNode",
            "type": "object"
        },
        "AuthoringTransition": {
            "additionalProperties": false,
            "properties": {
                "delta": {
                    "$ref": "#/$defs/AuthoringJsonValue"
                },
                "feedback": {
                    "$ref": "#/$defs/AuthoringJsonValue"
                },
                "from": {
                    "items": {
                        "minLength": 1,
                        "type": "string"
                    },
                    "maxItems": 2,
                    "minItems": 2,
                    "title": "From",
                    "type": "array"
                },
                "lessons_triggered": {
                    "$ref": "#/$defs/AuthoringJsonValue"
                },
                "outcome": {
                    "enum": [
                        "safe",
                        "at_risk",
                        "compromised"
                    ],
                    "title": "Outcome",
                    "type": "string"
                },
                "to": {
                    "minLength": 1,
                    "title": "To",
                    "type": "string"
                }
            },
            "required": [
                "from",
                "to"
            ],
            "title": "AuthoringTransition",
            "type": "object"
        }
    },
    "additionalProperties": false,
    "properties": {
        "_ab": {
            "$ref": "#/$defs/AuthoringJsonValue"
        },
        "_meta": {
            "additionalProperties": {
                "$ref": "#/$defs/AuthoringJsonValue"
            },
            "title": "Meta",
            "type": "object"
        },
        "nodes": {
            "additionalProperties": {
                "$ref": "#/$defs/AuthoringNode"
            },
            "title": "Nodes",
            "type": "object"
        },
        "start_node": {
            "minLength": 1,
            "title": "Start Node",
            "type": "string"
        },
        "transitions": {
            "items": {
                "$ref": "#/$defs/AuthoringTransition"
            },
            "title": "Transitions",
            "type": "array"
        },
        "wire_version": {
            "maximum": 1,
            "minimum": 1,
            "title": "Wire Version",
            "type": "integer"
        }
    },
    "required": [
        "start_node",
        "nodes",
        "transitions"
    ],
    "title": "TreeSpecAuthoringDocument",
    "type": "object"
} as const;
export const MAX_AUTHORING_JSON_NUMBER = 9007199254740991;
