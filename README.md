# Dynamics CRM Easy Translation

## Purpose
This is a tool that eases adding translations for CRM.
It supports changing of existing translations and adding of new translations, for now only for field labels.

This is a beta, use at your own risk and export a backup solution before testing.

## How to use
After installing the solution, there will be a Translation Management Dashboard:
![translationdashboard](https://cloud.githubusercontent.com/assets/4287938/21961787/cf4cc916-db13-11e6-9888-1cdd6380e6a1.PNG)

There will be a column in the translation grid for every language installed in the organization.
Once the list of entities is loaded, select the one you want to translate.
Just add/change the translations using inline-editing in the grid.

After you did your changes, the save button will be enabled. By clicking it, the labels will be saved to CRM and the entity will be published.

## Next steps
Next steps are automatic translation using a translation API and adding options for translating other CRM parts (such as option set values), too.

## Tools used
I used [jQuery](https://github.com/jquery/jquery) and [w2ui](https://github.com/vitmalina/w2ui) for working with the grid. Requests to the CRM are sent using my [Web API Client](https://github.com/DigitalFlow/Xrm-WebApi-Client).

## License
This tool is licensed under the MIT, enjoy!
