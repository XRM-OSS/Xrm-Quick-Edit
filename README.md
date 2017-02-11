# Dynamics CRM Easy Translation

## Purpose
This is a tool that eases adding translations for CRM.
It supports changing of existing translations and adding of new translations.

There is an automated translation feature for missing labels, that tries to get a translation using the free Glosbe translation API.

This is a beta, use at your own risk and export a backup solution before testing.

## How to use
After installing the solution (download latest version [here](https://github.com/DigitalFlow/Xrm-Easy-Translation/releases)), there will be a Translation Management Dashboard present in your organization.

There will be a column in the translation grid for every language installed in the organization.
Once the list of entities is loaded, select the one you want to translate, as well as which part.
Just add/change the translations using inline-editing in the grid.
For missing translations, you can click the Auto Translate button, which will try to find fitting translations and enter them for you. You'll first have to select the source LCID, which is the column name of the column that contains the labels that should be translated and the destination LCID, which is the column name of the column that should be translated automatically.

After you did your changes, the save button will be enabled. By clicking it, the labels will be saved to CRM and the entity will be published.

## Precautions
When using bulk edit features such as Auto Translate or Find and Replace, be sure to expand all rows. Not expanded rows will not be processed during those features. This is also valid for saving, so be sure that all your changes are visible when saving.
This is a bug in w2ui and will eventually be fixed.

### Attributes
![translationdashboard](https://cloud.githubusercontent.com/assets/4287938/22001408/53ac0992-dc45-11e6-8d19-940516221d9f.PNG)

### OptionSet Values
![optionsettranslation](https://cloud.githubusercontent.com/assets/4287938/22116927/58ebb798-de72-11e6-97b2-fff3327acc38.PNG)

### Views
![views](https://cloud.githubusercontent.com/assets/4287938/22352769/d7baed72-e41d-11e6-9aea-c70246cfdf29.PNG)

### System Forms
![formtranslator](https://cloud.githubusercontent.com/assets/4287938/22186986/dc2bcfd8-e0fe-11e6-9f86-b9b61ddfb8dc.PNG)

Note regarding form translations: Unfortunately the CRM only returns the current user's language labels when retrieving a system form. Other language labels, even if present, are not returned. Therefore the dashboard changes the user language to each installed language and retrieves the form, for being able to display all labels. After having retrieved all of the forms, your user language is restored to your initial value again.
So please note that you should not abort loading of a form, as you might end up with a differnt language id (which you can of course just switch back in your options).

### System Form Names
![formmetatranslator](https://cloud.githubusercontent.com/assets/4287938/22621293/abe84faa-eb20-11e6-8d03-f281fadd5ef8.PNG)

### Entity Display (Collection) Names
![entitytranslator](https://cloud.githubusercontent.com/assets/4287938/22621291/a1596fba-eb20-11e6-82de-f56ac00aca55.PNG)

## Functions
### Find and Replace
When clicking Find and Replace, you can enter your search text as either regex (JS style) or plain text.
There is an option for ignoring the case when searching for matches.

![findandreplacestart](https://cloud.githubusercontent.com/assets/4287938/22790460/93e81880-eee6-11e6-87ef-a9761ccd821c.PNG)

After the find and replace has processed all records, you will be presented with a selection dialog.
Select all replacements that you want to apply and they will be changed in the grid.

![applyfindandreplace](https://cloud.githubusercontent.com/assets/4287938/22790577/f210c70e-eee6-11e6-8b86-a32fd65ba017.PNG)

## System requirements
### CRM Version
This solution is available for CRM 2016 >= 8.0, since it requires the Web API for operating.

### User permissions
This tool uses a wide range of metadata operations, your user should best be system administrator.

## Tools used
I used [jQuery](https://github.com/jquery/jquery) and [w2ui](https://github.com/vitmalina/w2ui) for working with the grid.
Requests to the CRM are sent using my [Web API Client](https://github.com/DigitalFlow/Xrm-WebApi-Client).
Automated translations are gathered using the awesome [Glosbe translation API](https://de.glosbe.com/a-api).

## License
This tool is licensed under the MIT, enjoy!
