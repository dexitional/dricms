# DESCRIPTION OF SYSTEM
- Build a Grant management system for the Directorate of Research, Innovation and Consultancy (DRIC) of University of Cape Coast. The system a universal platform for with a landing page with forms to fill and an admin page for admin users such as project Investigator, Project Co-investigator, Accountant, Clerk, Administrator. 

- /Users/dexitional/Documents/projects/FullStack/coreos/frontend/ehub/src/pages/dric

The Admin platform has a models for the following:

-- Funders - Database of funders that run projects. A funder can be associated with multiple projects. A funder form contains these fields: Funder name,Description,Location,Address,Phone Number,Email Address,Country,Website Address,Website Logo URL,Portal Address,Portal Username,Portal Password.

-- Project - Database of projects with each project being run in phases with phase reports and project overview page. The project form contain these fields: Project Title, Project Description,Total Funding in Figures,Funding Currency, Project Type (Consultancy | Project),Project Date Awarded,Project Start Date,Project End Date,Project's Country - linked to countries ( dropdown of searchable countries),Project's Funder - linked to funders (dropdown or searchable funders),Principal Investigator - linked to investigators ( dropdown of searchable investigators),Co-Investigator - linked to investigators ( dropdown of searchable investigators) and there can be more than one for a project, Project's Final Report - wysiwyg editor, Contract - file upload -  (any pdf or docx), Budget - file upload (any pdf or docx)

-- Phase - These are the main stages under a project with phase overview pages.It is linked to the project. The phase form contain the fields: Phase Title,Phase Description,Phase Number more like the order or sort number,Project Balance Brought Forward ($),Phase Budget / Disbursed Amount ($),Phase Actual Amount Spent ($),Phase Start Date,Phase End Date,Phase Report with a wysiwyg editor,

-- Activity - 

-- Investigators - These are responsible for leading or coordinating the projects. Investigators are also users of the system with dashboard. They can request for claims ( funds for a particular phase of a project which is issued to them in payment tranches by the accountant). The investigator form contains: Title,First Name,Middle Name(s),Last Name,Location,Phone Number,Email Address,Staff Number,Department,Address,Ghana Card Number,Account Name,Bank Name,Bank Account Number,Bank Branch,

-- Personnels - These are people assigned to manage an activity under a particular phase of the project.The investigator form contains: Title,First Name,Middle Name(s),Last Name,Location,Phone Number,Email Address,Staff Number,Department,Address,Ghana Card Number,Account Name,Bank Name,Bank Account Number,Bank Branch,

-- Claims (Request for funds) - These is a database of Claims for project phases. The form contains: Project Phase,Purpose of Request,Brief Description of Activity,Request Amount,Request Currency,Status(PENDING|PROCESSING|APPROVED|DECLINED)

-- Payments (In tranches )  - These is the disbursement of requested funds (claims). So a payment is linked to a request for funds. So there could be multiple payments towards one request.These is the form for payment:Reference( Automatically generated - 5 characters),Description,Tranche Request (dropdown of claim request - name of phase and project and princpal investigator name ),Tranche Amount,Tranche Currency, Tranche Conversion Rate, Date Issued

-- "/Users/dexitional/Documents/projects/FullStack/coreos/frontend/dricms/files/forms", This are forms related to the system, analyze and implement them. Some forms are enhancement to the system. Note that most of this forms shall have an automatically generated printouts after implementations.

# TECHNOLOGY STACK
- Tanstack start, Mono repo
- Database should use mysql with same credential as @capevars but switch database to dricms.
 
# DESIGN SYSTEM
- Use advance modern styles with beautifully customized charts.
- Use this as primary color #172554, and #fee2e2 as secondary. Use tailwindcss and ShadCn for components and styling.
- You can take forms,buttons and components inspiration from https://uiverse.io/elements
- Use modern layout structure with minimalistic styling for the admin layouts. Take inspiration from this file: [text](files/forms/layout.html)

