# IMPORTANT: WHEN EXECUTING A PLAN:

When executing a plan, start or proceed with the next logical phase of the plan and if there is still room in the context window proceed or start to the next logical phase after that, then check and repeat if there is still room in the context window, otherwise wrap up so we can perform `/compact` the context and proceed further.

# IMPORTANT:

If possible do auto `/compact` after implementing each phase
