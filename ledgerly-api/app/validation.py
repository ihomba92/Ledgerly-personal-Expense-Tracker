"""Check request data against a Pydantic schema and return clear, per-field errors."""
from flask import abort, jsonify, make_response, request
from pydantic import BaseModel, ValidationError

# Plain-language messages for Pydantic's error types.
FRIENDLY = {
    "missing": "This field is required.",
    "string_too_short": "This is too short.",
    "string_too_long": "This is too long.",
    "too_short": "Choose at least one.",
    "too_long": "That's too many at once.",
    "extra_forbidden": "This field isn't allowed.",
    "greater_than": "Enter an amount greater than 0.",
    "greater_than_equal": "This can't be negative.",
    "less_than_equal": "That amount is too large.",
    "decimal_max_places": "Use at most 2 decimal places.",
    "decimal_max_digits": "That amount is too large.",
    "decimal_parsing": "Enter a number.",
    "decimal_type": "Enter a number.",
    "int_parsing": "Enter a whole number.",
    "bool_parsing": "Use true or false.",
    "bool_type": "Use true or false.",
    "date_from_datetime_parsing": "Use a date like 2026-10-28.",
    "date_parsing": "Use a date like 2026-10-28.",
    "date_type": "Use a date like 2026-10-28.",
    "uuid_parsing": "That isn't a valid id.",
    "uuid_type": "That isn't a valid id.",
    "enum": "Choose one of the allowed options.",
    "literal_error": "Choose one of the allowed options.",
    "string_type": "Enter text.",
    "list_type": "Send a list.",
}


def field_errors(exc: ValidationError) -> dict:
    fields = {}
    for err in exc.errors():
        name = ".".join(str(p) for p in err["loc"]) or "body"
        if name in fields:
            continue
        if err["type"] == "value_error":
            message = err.get("ctx", {}).get("error")
            if err["loc"] and err["loc"][-1] == "email":
                message = "Enter a valid email address."
        elif err["type"] in ("string_too_short", "too_short") and isinstance(err.get("input"), str):
            message = f"Use at least {err.get('ctx', {}).get('min_length', 1)} characters."
        elif err["type"] in ("string_too_long", "too_long") and isinstance(err.get("input"), str):
            message = f"Use {err.get('ctx', {}).get('max_length')} characters or fewer."
        elif err["type"] == "enum":
            message = f"Choose one of: {err.get('ctx', {}).get('expected', '').replace(chr(39), '')}."
        else:
            message = FRIENDLY.get(err["type"])
        fields[name] = str(message or err["msg"])
    return fields


def parse_body(schema: type[BaseModel]) -> BaseModel:
    """Validate the JSON body. On failure, stop with 422 and a message per field:

    {"error": {"code": 422, "name": "Validation Error", "message": "...",
               "fields": {"email": "Enter a valid email address."}}}
    """
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        abort(400, description="Send the data as a JSON object.")
    try:
        return schema.model_validate(data)
    except ValidationError as exc:
        body = {"error": {"code": 422, "name": "Validation Error", "message": "Some fields need attention.",
                          "fields": field_errors(exc)}}
        abort(make_response(jsonify(body), 422))
