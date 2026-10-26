# Brooklyn Bourne Autofiller

The template editor and on-page panel share the same clean, flat styling with solid colors and bold headings. Use the **Theme** selector at the top of either view to choose **Black and yellow**, **Black and gold**, **Grey and maroon**, or **Forest green and mint green**. Your choice is saved on this computer and updates open panels immediately. Black and gold is the default.

Extract the ZIP and open the folder in IntelliJ. To use in Chrome, open `chrome://extensions`, enable Developer mode, and choose Load unpacked with this folder. For an existing installation, update its files and click Reload, then reload Dutchie product tabs.

## Manual strain descriptions

1. Open the extension popup and select a template or create one.
2. Enter Name, for example `Product name | Runtz | 3.5g (H)`.
3. In Online description, click **Copy strain name + type**. This copies only text such as `Runtz (H)`. If copying is blocked, the text is selected so you can press Ctrl+C.
4. Paste into your **Dispensary Strain Descriptions** ChatGPT conversation and send it to use your established format.
5. Reopen the popup; your unfinished template is restored. Paste only the reviewed paragraph into Online description (maximum 2500 characters), name the template, and click **Save template**.
6. On a Dutchie product form, select the saved template and click **Fill all**. Online details is filled last: Name into Online title, then your description. Blank descriptions are skipped. The page returns to Details.

The extension does not contact ChatGPT or strain websites. Research and generation happen when you send the prompt yourself. Descriptions are saved with templates and included in Export templates / Import templates.

Drafts preserve unfinished work locally; click Save template before exporting or filling. New clears the current draft.

SKU generation waits for an enabled Generate button and allows up to eight seconds for a response, then retries once if the field is still blank. Existing SKUs are preserved. If generation still fails, check the panel's status and Dutchie's validation, then try Generate manually.

## Bulk template creation

The popup has **Templates**, **Bulk editor**, and **Brand directory** tabs. The original bulk creator now opens the new templates straight into Bulk editor, where each field shows **Changed**, **Kept**, or **Blank** compared with the starting shared settings. Open an entry's **Changes** tab for its full before/after comparison. A cleared/blank template field is skipped by autofill; it does not erase an existing value on Dutchie.

Use **Search entries** to find products by product/template name, vendor, brand, or strain. **Collapse all / Expand all** compact or restore the entire batch; each entry also has **Minimize / Expand**. Search and collapsed states are remembered in the workspace draft. While searching, Select all and shared edits affect only shown entries; Save all still saves all entries, including hidden ones.

In Bulk editor you can load existing saved templates, edit multiple products together, select entries and apply one field to them, or open the batch in a separate larger window. Each entry has its own **Details**, **Online description**, and **Changes** tabs. Descriptions are never copied to another new product automatically. **Save all templates** saves the current entries; it validates the whole batch before writing and preserves unrelated templates. Editing an existing product's Name keeps its original saved template key. A duplicate new template name is rejected. If another window changed a saved template, use **Reload** on that entry to review the latest data before saving.

Use **Brand directory** to save a vendor and multiple brands. Vendor name suggests learned Dutchie names, saved directory vendors, and vendors from templates. Selecting a saved vendor restores its pairings. Search brands and select several suggestions; selections remain as removable chips while you search. Use Arrow keys and Enter to select, Escape to close suggestions, or Backspace in an empty search to remove the last chip. You can also add a new exact brand name with Enter. Click **Save pairing** to remember changes, or use **Remember pairs from saved templates** to collect existing pairings.

The main template editor suggests that vendor's brands. Select a vendor and check its brands to create a separate bulk window with one starting entry per selected brand; use Add product or Duplicate settings for more. Shared settings from the template form carry into batches launched from the popup directory. Pairings are included in template exports and merged on import. Saved workspace drafts recover unfinished batches after reload.

Set the shared form values, then expand **Bulk template creation**. Paste one full product Name per line, click **Preview templates**, and then **Create templates**. Each line becomes a saved template named after the product. Existing template names and duplicate lines are skipped, preserving existing data.

You can also paste up to three tab-separated columns from a spreadsheet, without a header: **Name**, **Strain**, **Description**. Strain and description are blank unless supplied in that row. External ID is blank for each new template. All other editable fields are shared from the form, including category, prices, measurements, THC, vendor, brand, inventory settings, and the location-copy checkbox. Review these shared settings before creating templates. Bulk input is remembered in the popup draft.

Type and Default unit are locked to **Quantity** in the editor. Full fills always apply Quantity regardless of old template values; each selection is verified and retried once if it does not stick. Any remaining failure appears in the fill status.

## Performance

The panel responds to product-form mounting and removal rather than polling while idle. Draft writes are grouped during typing and flushed when leaving the field or popup; unchanged drafts are not written again. Already-correct text fields are skipped to avoid unnecessary input events. Dropdown selection and SKU response waits retain their reliability checks.

