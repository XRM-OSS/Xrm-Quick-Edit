# Dynamics CRM Quick Edit

## Purpose
This is a tool that eases development tasks in CRM.
It supports changing of existing translations and adding of new translations for all kind of CRM parts.
In addition to that, you can change properties such as field security status on fields in bulk.

There is an automated translation feature for missing labels, that tries to get a translation using the free Glosbe translation API.

This is a beta, use at your own risk and export a backup solution before testing.

## How to use
After installing the solution (download latest version [here](https://github.com/DigitalFlow/Xrm-Quick-Edit/releases)), there will be some dashboards and their requirements added to your organization.

## Translating Dynamics 365 Portals
Since v3.7.0, content snippets for Dynamics 365 Portals can be translated as well.
For doing so, simply choose "Content Snippet (Adx_contentsnippet)" as entity to translate and "Content" as type.
You will then be able to translate the values of content snippets.
Be aware that all languages of all websites are added as columns.
If any values are not saved, you most probably don't have that specific language enabled for the contained website.

## Configuration
There are multiple settings which you can manipulate inside the "oss_/XrmQuickEdit/config/XrmQuickEditConfig.js" webresource.

### entityWhiteList
Type: Array<string>
List of entity logical names which should be available in the translation dashboard. Allows all if empty.

### hideAutoTranslate
Type: boolean
Define whether to hide the Auto Translate button.

### hideFindAndReplace
Type: boolean
Define whether to hide the Find and Replace button.

### hideLanguagesByDefault
Type: boolean
Define whether to hide all language columns but the current user's language by default. More columns can then be included in the grid.

### lockedLanguages
Type: Array<int>
Locale IDs of Languages that should not be translatable

### solutionUniqueName
Type: string
If set, components that were translated will be automatically added to the solution with the defined unique name.

## Dashboards
### Translation Management Dashboard
There will be a column in the translation grid for every language installed in the organization.
Once the list of entities is loaded, select the one you want to translate, as well as which part.
For entities and attributes you can even select, whether you want to translate the display names, or the descriptions.
This does not have an effect on any of the other types right now.
Just add/change the translations using inline-editing in the grid.
For missing translations, you can click the Auto Translate button, which will try to find fitting translations and enter them for you. You'll first have to select the source LCID, which is the column name of the column that contains the labels that should be translated and the destination LCID, which is the column name of the column that should be translated automatically.

After you did your changes, the save button will be enabled. By clicking it, the labels will be saved to CRM and the entity will be published.

#### Attributes
![attributetranslation](https://cloud.githubusercontent.com/assets/4287938/23101939/9e48451e-f69f-11e6-9572-3480aa0eed8d.PNG)

#### OptionSet Values
![optiontranslator](https://cloud.githubusercontent.com/assets/4287938/23101940/9e48b558-f69f-11e6-86a6-f1bcbb34fbfe.PNG)

#### Views
![viewtranslator](https://cloud.githubusercontent.com/assets/4287938/23101937/9e46a95c-f69f-11e6-9340-1a810e091140.PNG)

#### System Forms
![formhandler](https://cloud.githubusercontent.com/assets/4287938/23101938/9e482f2a-f69f-11e6-909f-619ddfffcdcb.PNG)

Note regarding form translations: Unfortunately the CRM only returns the current user's language labels when retrieving a system form. Other language labels, even if present, are not returned. Therefore the dashboard changes the user language to each installed language and retrieves the form, for being able to display all labels. After having retrieved all of the forms, your user language is restored to your initial value again.
So please note that you should not abort loading of a form, as you might end up with a different language id (which you can of course just switch back in your options).
In addition to that, sometimes publishing of CRM forms does not finish, if the UI language does not match the base language. Be sure to upgrade to at least v2.6.1 of this project, because since this version, the UI language is set to the base language before saving and publishing the changes. Your initial language is restored afterwards.
If you still experience issues with the latest version, please file an issue on GitHub. When publishing should get stuck, publish changes on another entity and try again afterwards.

##### Form Labels are not updated
You might come across issues where you translate attributes and the labels in the form do not update appropriately.
In that case, you probably overwrote the form labels for this attribute, which is why changes in the attribute label take no effect.
Since v3.15.0 there is a cure for this issue: When inside the form translator, there is a button "Remove Overridden Attribute Labels", which removes all overridden attribute labels from your form. After that, your update attribute labels should display in the form as well again.

> Use "Remove Overridden Attribute Labels" at your own risk. Please backup the forms before using this function by putting them in a solution and exporting it.

#### System Form Names
![formmetahandler](https://cloud.githubusercontent.com/assets/4287938/23101941/9e4994f0-f69f-11e6-9c7e-e8d39aa2ce21.PNG)

#### Entity Display (Collection) Names
![entityhandler](https://cloud.githubusercontent.com/assets/4287938/23101942/9e4cc1ca-f69f-11e6-8e0a-8f040380623a.PNG)

#### Functions
##### Find and Replace
When clicking Find and Replace, you can enter your search text as either regex (JS style) or plain text.
There is an option for ignoring the case when searching for matches.
When using it with regular expressions, JS regular expressions are used. This gives you also the possibility for using capture groups and reordering in your replace expression. For example when using find text: ```(Account) (.*)``` and replace text: ```$2 $1``` you can reorder the text, so that `Account Number` becomes `Number Account`.

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
