import java.net.HttpURLConnection;
import java.net.URI;

/** Small probe compiled with the build JDK; no extra package manager in runtime. */
public final class Healthcheck {
    public static void main(String[] args) {
        try {
            var connection = (HttpURLConnection) URI.create("http://127.0.0.1:8080/health")
                    .toURL().openConnection();
            connection.setConnectTimeout(2000);
            connection.setReadTimeout(12000);
            int status = connection.getResponseCode();
            connection.disconnect();
            System.exit(status == 200 ? 0 : 1);
        } catch (Exception ignored) {
            System.exit(1);
        }
    }
}
