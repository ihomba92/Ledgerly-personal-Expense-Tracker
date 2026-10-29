// Show the API's per-field errors under the matching form inputs.
//   applyFieldErrors(form, err, { full_name: "fullName" })
// Returns true if at least one field error was shown.
export function applyFieldErrors(form, err, rename = {}) {
  const fields = err?.fields ?? {};
  let shown = false;
  Object.entries(fields).forEach(([apiName, message]) => {
    const name = rename[apiName] ?? apiName;
    if (form.getValues(name) !== undefined) {
      form.setError(name, { type: "server", message });
      shown = true;
    }
  });
  return shown;
}
