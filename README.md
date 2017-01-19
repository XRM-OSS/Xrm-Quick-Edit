# Dynamics CRM Easy Translation

## Purpose
This is a tool that eases adding translations for CRM.
It supports changing of existing translations and adding of new translations, for now only for field labels.

There is an automated translation feature for missing labels, that tries to get a translation using the free Glosbe translation API.

This is a beta, use at your own risk and export a backup solution before testing.

## How to use
After installing the solution, there will be a Translation Management Dashboard present in your organization.

There will be a column in the translation grid for every language installed in the organization.
Once the list of entities is loaded, select the one you want to translate, as well as which part.
Just add/change the translations using inline-editing in the grid.
For missing translations, you can click the Auto Translate button, which will try to find fitting translations and enter them for you. You'll first have to select the source LCID, which is the column name of the column that contains the labels that should be translated and the destination LCID, which is the column name of the column that should be translated automatically.

After you did your changes, the save button will be enabled. By clicking it, the labels will be saved to CRM and the entity will be published.

Currently the following parts can be translated:

### Attributes
![translationdashboard](https://cloud.githubusercontent.com/assets/4287938/22001408/53ac0992-dc45-11e6-8d19-940516221d9f.PNG)

### OptionSet Values
![optionsettranslation](https://cloud.githubusercontent.com/assets/4287938/22116927/58ebb798-de72-11e6-97b2-fff3327acc38.PNG)

## Next steps
Next steps are adding options for translating other CRM parts (such as option set values), too.

## Tools used
I used [jQuery](https://github.com/jquery/jquery) and [w2ui](https://github.com/vitmalina/w2ui) for working with the grid.
Requests to the CRM are sent using my [Web API Client](https://github.com/DigitalFlow/Xrm-WebApi-Client).
Automated translations are gathered using the awesome [Glosbe translation API](https://de.glosbe.com/a-api).

## License
This tool is licensed under the MIT, enjoy!
