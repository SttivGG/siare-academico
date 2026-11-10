package com.siare.core;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class SiareCoreApplication {

	public static void main(String[] args) {
		// Docker removes service DNS records while a container is stopped. Do not cache
		// those negative answers across an immediate user retry after recovery.
		java.security.Security.setProperty("networkaddress.cache.negative.ttl", "0");
		java.security.Security.setProperty("networkaddress.cache.ttl", "5");
		SpringApplication.run(SiareCoreApplication.class, args);
	}

}
