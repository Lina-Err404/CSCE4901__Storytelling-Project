
const { getSupabase } = require("./supabase");

async function requireSupabaseTeacher(req, res, next) {
    const authorization = req.get("authorization");

    const match = typeof authorization === "string"
        ? authorization.match(/^Bearer\s+([^\s]+)$/i)
        : null;

    if (!match) {
        return res.status(401).json({
            error: "Unauthorized"
        });
    }

    try {
        const supabase = getSupabase();

        const { data, error } = await supabase.auth.getUser(match[1]);

        if (error || !data.user) {
            return res.status(401).json({
                error: "Invalid authentication token"
            });
        }

        req.user = {
            uid: data.user.id
        };

        next();
    } catch (error) {
        return res.status(500).json({
            error: "Authentication failed"
        });
    }
}

module.exports = { requireSupabaseTeacher };
