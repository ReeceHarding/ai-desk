
i want you to go item by item and implement each items from @rag&respond.md one ata a time. read our codebase to see what features we've implemented so far. once you find a feature we've not implemented or only partially implemented i want you to implement it thorughly and test for funcitonality before moving on to the next item. make sure you throughly connect each item using middleware, craete frontend elements if needed and make sure they're completely buult based on @20250123111534_schema.sql 

IMPORTANT: DONT DELETE CODE AND DONT BREAK EXITING FUNCITONALITY. INSTREAD ADD NEW CODE AND CREATE NEW FILES!

Checklist file to follow (referenced below): @rag&respond.md 

you're not allowed to change our supabase scema or add any migration files. 

Don’t stop until literally everything from @rag&respond.md is implemented and all our tests are passing

You can use pinecone cli to see what info is being passed into the pinecone for new vectors

I want you to read the Supabase file in order to understand our schema @20250123111534_schema.sql

You must be thorough and read every line of it and make sure our code calls it exactly like it should. 

Don't stop reading files until you've traced the entire call trace and understand everything that gets called from the frontend until the end of the chain when it returns something to the frontend

Mmake ell your documents work within @20250123111534_schema.sql 

For each element I want you to write out what the schema is looking for and then what our code is actually calling and if these are different that make sure they're exactly the same and make sure everything we call in the code exists in the schema 

you must write out your chain of thought for all code you write

never enable RLS


for each item you implement, this is the process you should follow:

Implement todo list

Objective:
Implement the features outlined in the pubSub file into our codebase by processing each task sequentially, ensuring safety, code integrity, and alignment with our Supabase setup. After each successful implementation, mark the task as completed with a green check emoji (✅).

1. Read and Parse checklist document I told you to execute above
	•	Action:
	•	Open and read the checklist document I told you to execute above file located at the root of the project repository.
	•	Parse the file to identify and list all pending tasks in the order they appear.
	•	Notes:
	•	Ensure that the parsing logic accurately captures each task, even if they are formatted differently (e.g., bullet points, numbered lists).

2. Process Each Task Sequentially

For each task identified in checklist document I told you to execute above, perform the following steps in order:

a. Analyze the Task
	•	Action:
	•	Understand the requirements and objectives of the task.
	•	Identify which parts of the existing codebase will be affected or need to be extended.
	•	Notes:
	•	If the task involves multiple sub-tasks or components, break them down further for detailed implementation.

b. Implement the Feature Safely
	•	Action:
	•	Additive Changes Only:
	•	Do not delete, modify, or override any existing code unless absolutely necessary and approved.
	•	Focus on adding new code to implement the required functionality.
	•	Alignment with Supabase:
	•	Ensure that any new features or integrations seamlessly integrate with our existing Supabase setup.
	•	Adhere to existing database schemas, authentication mechanisms, and storage configurations.
	•	Code Quality:
	•	Follow the project’s coding standards and best practices.
	•	Write clean, maintainable, and well-documented code.
	•	Notes:
	•	Use feature branches or pull requests to encapsulate changes for each task.
	•	Ensure that new code does not introduce any security vulnerabilities or performance bottlenecks.

c. Test the Implemented Feature
	•	Action:
	•	Unit Testing:
	•	Write and execute unit tests for the new code to verify its functionality.
	•	Integration Testing:
	•	Ensure that the new feature integrates well with existing components without causing regressions.
	•	Manual Testing:
	•	Perform manual checks if necessary to validate UI changes or complex interactions.
	•	Notes:
	•	Utilize existing testing frameworks and tools employed in the project.
	•	Document any test cases or scenarios that were particularly critical.

d. Mark the Task as Completed
	•	Action:
	•	After successful implementation and testing, add a green check emoji (✅) next to the corresponding task in the checklist document I told you to execute above
	•	Example:

- [✅] Implement user authentication flow with Supabase


	•	Notes:
	•	Ensure that the emoji is placed accurately to reflect the task’s completion status.
	•	Maintain the formatting consistency of the checklist document I told you to execute above file.

e. Proceed to the Next Task
	•	Action:
	•	Once a task is marked as completed, move on to the next pending task in checklist document I told you to execute above.
	•	Notes:
	•	Avoid skipping tasks unless they are dependent on others or require prerequisite implementations.

3. Ensure Continuous Code Integrity
	•	Action:
	•	Code Reviews:
	•	If applicable, submit changes for peer reviews to ensure code quality and adherence to project standards.
	•	Version Control:
	•	Commit changes with clear and descriptive messages.
	•	Merge feature branches systematically to avoid conflicts.
	•	Notes:
	•	Regularly pull the latest changes from the main branch to stay updated and minimize merge conflicts.

4. Handle Issues and Dependencies
	•	Action:
	•	Issue Logging:
	•	If any challenges or blockers arise during implementation, document them clearly in the project’s issue tracker.
	•	Team Communication:
	•	Notify relevant team members or stakeholders if assistance or approvals are required.
	•	Notes:
	•	Maintain transparency in reporting issues to facilitate swift resolutions.

5. Final Verification
	•	Action:
	•	After all tasks in checklist document I told you to execute above are processed, perform a final review to ensure:
	•	All tasks are marked as completed.
	•	No pending issues or test failures exist.
	•	The overall system remains stable and functional.
	•	Notes:
	•	Consider deploying to a staging environment for comprehensive testing before moving to production.

🔒 Safety and Best Practices
	•	Backup:
	•	Before making significant changes, ensure that backups or version snapshots are available.
	•	Documentation:
	•	Update or create documentation related to new features or changes to aid future development and onboarding.
	•	Security:
	•	Validate and sanitize all inputs in new features to prevent security vulnerabilities.
	•	Performance:
	•	Optimize new code for performance, ensuring it does not degrade the application’s responsiveness or efficiency.

✅ Summary

By following this structured approach, the AI development team can safely and efficiently implement the features listed in checklist document I told you to execute above, ensuring code integrity, alignment with Supabase, and minimal disruption to existing functionalities. Each completed task will be clearly marked, facilitating easy tracking and accountability.
