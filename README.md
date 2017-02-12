# Dynamics CRM Quick Edit

## Purpose
This is a tool that eases development tasks in CRM.
It supports changing of existing translations and adding of new translations for all kind of CRM parts.
In addition to that, you can change properties such as field security status on fields in bulk.

There is an automated translation feature for missing labels, that tries to get a translation using the free Glosbe translation API.

This is a beta, use at your own risk and export a backup solution before testing.

## How to use
After installing the solution (download latest version [here](https://github.com/DigitalFlow/Xrm-Quick-Edit/releases)), there will be some dashboards and their requirements added to your organization.

## Precautions
When using bulk edit features such as Auto Translate or Find and Replace, be sure to expand all rows. Not expanded rows will not be processed during those features. This is also valid for saving, so be sure that all your changes are visible when saving.
This is a bug in w2ui and will eventually be fixed.

## Dashboards
### Translation Management Dashboard
There will be a column in the translation grid for every language installed in the organization.
Once the list of entities is loaded, select the one you want to translate, as well as which part.
Just add/change the translations using inline-editing in the grid.
For missing translations, you can click the Auto Translate button, which will try to find fitting translations and enter them for you. You'll first have to select the source LCID, which is the column name of the column that contains the labels that should be translated and the destination LCID, which is the column name of the column that should be translated automatically.

After you did your changes, the save button will be enabled. By clicking it, the labels will be saved to CRM and the entity will be published.

#### Attributes
![translationdashboard](https://cloud.githubusercontent.com/assets/4287938/22001408/53ac0992-dc45-11e6-8d19-940516221d9f.PNG)

#### OptionSet Values
![optionsettranslation](https://cloud.githubusercontent.com/assets/4287938/22116927/58ebb798-de72-11e6-97b2-fff3327acc38.PNG)

#### Views
![views](https://cloud.githubusercontent.com/assets/4287938/22352769/d7baed72-e41d-11e6-9aea-c70246cfdf29.PNG)

#### System Forms
![formtranslator](https://cloud.githubusercontent.com/assets/4287938/22186986/dc2bcfd8-e0fe-11e6-9f86-b9b61ddfb8dc.PNG)

Note regarding form translations: Unfortunately the CRM only returns the current user's language labels when retrieving a system form. Other language labels, even if present, are not returned. Therefore the dashboard changes the user language to each installed language and retrieves the form, for being able to display all labels. After having retrieved all of the forms, your user language is restored to your initial value again.
So please note that you should not abort loading of a form, as you might end up with a differnt language id (which you can of course just switch back in your options).

#### System Form Names
![formmetatranslator](https://cloud.githubusercontent.com/assets/4287938/22621293/abe84faa-eb20-11e6-8d03-f281fadd5ef8.PNG)

#### Entity Display (Collection) Names
![entitytranslator](https://cloud.githubusercontent.com/assets/4287938/22621291/a1596fba-eb20-11e6-82de-f56ac00aca55.PNG)

#### Functions
##### Find and Replace
When clicking Find and Replace, you can enter your search text as either regex (JS style) or plain text.
There is an option for ignoring the case when searching for matches.

![findandreplacestart](https://cloud.githubusercontent.com/assets/4287938/22790460/93e81880-eee6-11e6-87ef-a9761ccd821c.PNG)

After the find and replace has processed all records, you will be presented with a selection dialog.
Select all replacements that you want to apply and they will be changed in the grid.

![applyfindandreplace](https://cloud.githubusercontent.com/assets/4287938/22790577/f210c70e-eee6-11e6-8b86-a32fd65ba017.PNG)

### Property Editor Dashboard
![propertyeditor](https://cloud.githubusercontent.com/assets/4287938/22862381/b547167c-f12d-11e6-838c-633358003d59.PNG)

This is a dashboard for changing properties on CRM parts. Currently there is support for CRM fields only.
You can change the following properties in bulk:
- Required Level
- Is Audit Enabled
- Is Valid for Advanced Find
- Is Secured

Afterwards hit "Save" and the updates will be sent and published.
When changing the field security state on fields, you might receive the following error:
```
The user does not have full permissions to unsecure the attribute...
```

There seems to be a background workflow in CRM that works on change of these properties, if you receive above error, wait a few minutes and try again. 
Setting required level of a field to SystemRequired as well as trying to change a field's level from SystemRequired will not send any updates for this, since this is not allowed.


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
