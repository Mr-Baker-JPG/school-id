Authorization All API Requests require two headers (keep these confidential):

Ocp-Apim-Subscription-Key: The subscription key from the profile page.
Facts-Api-Key: The API key given from the school/district. All FACTS API keys
are unique per school/district and are authorized for specific scopes implicity.

One subscription key can then use many different FACTS API Keys to connect to
multiple districts/schools.

Sandbox Data To use our sandbox data replace your Facts-Api-Key with the string
SandboxKey

Example:

curl -X GET "https://api.factsmgt.com/people/Address?api-version=1" -H
"Ocp-Apim-Subscription-Key: YourOCPApimSubscriptionKey" -H "Facts-Api-Key:
SandboxKey"

---

API Scopes Each API key is authorized for specific scopes as defined by the
school/district.

District Wide or School Independent FACTS allows API keys to be set to either
district wide or school independent by the FACTS school admin.

School Specific: The API key returns only data for a specific school in the
FACTS district. District Wide: The API key returns data for all schools in the
FACTS district. API Domains A FACTS school admin has the ability to grant or
limit domains of data within their system. Each domain can have read only access
which will only allow GET methods, or write access which allow for all HTTP
methods available. A school can change these domain permissions at any time
without requiring a change to the API key.

Available Domains People: Student, parent, staff, and family related data.
Academic: Classes and enrollment related data. Gradebook: Assignment and Grades
related data. Billing: Student Billing and Accounting related data. Medical:
Medical related data. Scheduling: Scheduling related data. Logging: Logging
related data.

---

Filtering All GET requests that return multiple values can be filtered by
fields. This allows for an optimized query to prevent looping through unneeded
records.

Example GET
https://api.factsmgt.com/people/Address?filters=state==NY&api-version=1 This
will return all addresses with a state of New York.

Using the filters query parameter The filters parameter allows for a
comma-delimited list of {Name}{Operator}{Value} attributes.

Name: The name of the object field to filter on. Operator: An operator from the
table below. Value: The value of the field to filter. To filter based on
multiple values use a pipe to delimit the values. state==NY|NJ|OR. Spaces are
allowed in the values. Operators Operator Meaning == Equals != Not equals

>     Greater than
>
> < Less than = Greater than or equal to <= Less than or equal to @= Contains _=
> Starts with !@= Does not Contains !_= Does not Starts with @=_
> Case-insensitive string Contains \_=_ Case-insensitive string Starts with ==_
> Case-insensitive string Equals !=_ Case-insensitive string Not equals !@=_
> Case-insensitive string does not Contains !\_=_ Case-insensitive string does
> not Starts with Further examples Let's assume we are using the Dataset below:

Id FirstName LastName Age 1 John Watson 32 2 Jon Arbuckle 45 3 Lyndon Johnson 56
4 John Wayne 43 Basic Filter GET
https://api.factsmgt.com/api/person?filter=FirstName==John Id FirstName LastName
Age 1 John Watson 32 4 John Wayne 43 OR Filter on Values GET
https://api.factsmgt.com/api/person?filter=FirstName==John|Jon Id FirstName
LastName Age 1 John Watson 32 2 Jon Arbuckle 45 4 John Wayne 43 OR Filter on
Keys; Sorting by LastName GET
https://api.factsmgt.com/api/person?filter=(FirstName|LastName)_=John&sort=LastName
Id FirstName LastName Age 3 Lyndon Johnson 56 1 John Watson 32 4 John Wayne 43
AND Filter GET
https://api.factsmgt.com/api/person?filter=FirstName==John,Age==43 Id FirstName
LastName Age 4 John Wayne 43 CONTAINS Filter; Sorting by Age Descending GET
https://api.factsmgt.com/api/person?filter=LastName@=*son&sort=-Age Id FirstName
LastName Age 3 Lyndon Johnson 56 1 John Watson 32

---

Pagination The FACTS API allows for pagination of results.

Page request parameters To get a specific page pass the page parameter in the
endpoint url. GET https://api.factsmgt.com/people/Address?page=2 To change the
amount of results per page use the pageSize parameter in the endpoint url. GET
https://api.factsmgt.com/people/Address?page=2&pageSize=10 The paged result
object Each GET endpoint that returns multiple values will return a paged result
object like below:

{ "results": [], "currentPage": 1, "pageCount": 2, "pageSize": 1, "rowCount": 1,
"nextPage": "https://api.factsmgt.com/people/Address?page=2" }

---

Sorting The FACTS API allows for sorting of results.

Sorting request parameters To sort based on specific fields pass the sorts
parameter in the endpoint url. GET
https://api.factsmgt.com/people/Address?sorts=city,state,-country The sorts
parameter takes in a comma delimited list based on the order in which the fields
are given. Additionally, when a field is prefixed with a (-) sign, it will sort
it in descending order. The request above sorts addresses by City (ascending)
then State (ascending) then Country (descending)

All sorting takes place before filtering and pagination.

---

Limits/Quotas FACTS API imposes both rate limits and quotas to ensure good
performance. These limits are enforced on a subscription level.

Rate limits Each subscription level has a rate limit to prevent API usage
spikes. The rate limit is a finite amount of requests that can be called.

Here are the rate limits per subscription:

Basic:

10 requests/second 10 requests/minute Pro:

10 requests/second 100 requests/minute Enterprise:

10 requests/second 600 requests/minute When a rate limit has been hit you will
receive the following response status code:

429 Too Many Requests Quotas Each subscription level has a daily quota of how
many requests it allows.

Here are the quotas per subscription:

Basic: 10,000 requests/day Pro: 100,000 requests/day Enterprise: 1 million
requests/day Caches All responses will be cached for up to two minutes. If you
have a need to bypass the cache you can include the below header in your request
with the current unix epoch time as a value.

x-bypass-cache: 1617125626

---

User Identifiers In our API, the personId retrieved from the People > Person
endpoint can be used interchangeably with studentId, parentId, and staffId
across various endpoints. This allows for seamless integration and connection
between different endpoints.

For example: GET
https://api.factsmgt.com/Students?studentId=={personId}&api-version=1.0

---
