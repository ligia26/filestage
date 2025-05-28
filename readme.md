I will shortly describe my implementation of features, outcomes/techincal approaches and limitations for the project.
I decided to implement 3 of the listed features:

1. Comment replies
   As a project owner, I would like to add replies to comments so that I can have
   a conversation with the reviewer.
2. Linkify URLs in comments
   When a URL is included in a comment, it should be a clickable link once the
   comment is created.
3. Lazy loading comments
   When a file has a lot of comments it is slow to load all of them at once.
   Implement infinite scrolling for comments.

They are all working as intended, for some of them I added console logs and tests, as well. Error handling and clean code principles are followed all along the implementation.

1. Comment replies
   Enables project owners to respond to specific comments, forming a thread of replies beneath each top-level comment.

Backend:

Extended the existing comment model to support a parentId or similar field, allowing comments to reference another comment as their parent.

Updated the API to handle nested comment creation, ensuring replies are stored with the correct parent-child relationship.

Frontend:

Updated the UI to render replies directly beneath their parent comments using a recursive or grouped rendering approach.

Added a “Reply” button to each top-level comment, which toggles a reply input field.

On submit, the reply is sent to the API with the parent comment's ID, and the UI updates accordingly to reflect the new thread.

2. Linkify URLs in Comments
   Feature:
   Automatically converts plain text URLs in user comments into clickable hyperlinks after the comment is posted.

Parsed the comment text using a link-detection regex or a utility like linkifyjs or a custom regex.

Transformed detected URLs into <a href="...">...</a> tags with target="\_blank" for opening in a new tab and rel="noopener noreferrer" for security.

Ensured the transformed content is safely rendered, e.g., using dangerouslySetInnerHTML in React (if sanitized) or a safe HTML renderer, to prevent XSS vulnerabilities.

3. Lazy Loading / Infinite Scrolling for Comments
   Feature:
   Improves performance by loading comments in chunks (batches) as the user scrolls, instead of rendering all at once.

Backend:

Implemented pagination for comments, likely using a limit and offset or cursor-based approach in the API.

Returned paginated comments, possibly with metadata like hasMore or nextCursor.

Frontend:

Added an infinite scroll hook or observer (e.g., IntersectionObserver) that watches when the user reaches the bottom of the comment list.

When triggered, the app makes a new API call to fetch the next batch of comments.

Fetched comments are appended to the existing list in the UI, without a full reload.

Limitations:

For the 2nd feature, I used a regex to detect URLs in the comment text, which might not be 100% accurate. The first attempt was to use a library like linkifyjs, but it didn't work as expected, as it was not compatible with Vite.

For the 3rd feature, I wouldn't necessarily consider this a limitation but the comments are retrieved from oldest to newest, so scrolling to the newest one can be out of hand.

For the 1st feature, I initially considered implementing role-based restrictions for features like comment replies (e.g., limiting replies to project owners only). However, I decided against it in this version because the ideal approach would involve conditionally hiding or disabling UI elements like the "Reply" button based on the user’s role.
Since role information wasn't readily available on the frontend—or would have required a more complex state management or API update—I chose not to implement a partial or hard-coded solution. Instead of risking inconsistency between the UI and actual permissions, I opted to focus on a clean, functional experience for all users.
This keeps the codebase simple and avoids misleading behaviors, while still leaving the door open for a more robust role-based system in a future iteration.
