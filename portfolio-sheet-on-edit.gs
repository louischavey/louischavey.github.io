/**
 * Install this as an on-edit trigger in the portfolio's Google Sheet.
 * Store the Vercel deploy hook as the VERCEL_DEPLOY_HOOK_URL script property.
 */
function triggerPortfolioDeploy(event) {
  const properties = PropertiesService.getScriptProperties();
  const expectedSheet = properties.getProperty("WORKS_SHEET_NAME");
  if (expectedSheet && event.range.getSheet().getName() !== expectedSheet) return;

  const deployHook = properties.getProperty("VERCEL_DEPLOY_HOOK_URL");
  if (!deployHook) throw new Error("Set VERCEL_DEPLOY_HOOK_URL in Script Properties before installing this trigger.");

  const response = UrlFetchApp.fetch(deployHook, { method: "post", muteHttpExceptions: true });
  if (response.getResponseCode() >= 300) {
    throw new Error(`Vercel deploy hook failed: ${response.getResponseCode()} ${response.getContentText()}`);
  }
}
